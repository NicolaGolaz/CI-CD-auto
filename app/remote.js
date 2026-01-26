const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// Récupère la branche par défaut du repo
async function getDefaultBranch(owner, repo, token) {
    const url = `https://api.github.com/repos/${owner}/${repo}`;
    const response = await fetch(url, { 
        headers: { 
            'Authorization': `Bearer ${token}`
        }});
    const data = await response.json();
    console.log(data)
    return data.default_branch;
}

// Récupère les fichiers du repos en ignorant les fichier du script
async function getRepoFiles(owner, repo, token, branch) {
    const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json'
        }
    })
    const data = await response.json();

    return data.tree.map(item => item.path);
}

// Récupère le contenu des fichiers 
async function getRawFileContent(owner, repo, filePath, token, branch) {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) return null;
    return await response.text();
}

// Push les fichiers sur github
async function pushFileToGitHub(owner, repo, filePath, content, token) {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
    
    // Récupérer le SHA du fichier s'il existe déjà
    let currentSha = null;
    try {
        const getRes = await fetch(url, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json'
            }
        });
        
        if (getRes.ok) {
            const fileData = await getRes.json();
            currentSha = fileData.sha; // C'est la clé pour la mise à jour
        }
    } catch (e) {
        // Si erreur ou 404, on considère que le fichier est nouveau (currentSha reste null)
    }

    // Encoder le contenu en Base64
    const base64Content = Buffer.from(content).toString('base64');

    const body = {
        message: `ci: generate workflow ${path.basename(filePath)}`,
        content: base64Content
    };

    // Si on a un SHA, on l'ajoute pour dire à GitHub qu'on met à jour
    if (currentSha) {
        body.sha = currentSha;
    }

    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (response.ok) {
        console.log(`${currentSha ? 'Mis à jour' : 'Créé'} : ${filePath}`);
    } else {
        const error = await response.json();
        console.error(`Erreur lors de l'envoi de ${filePath} :`, error.message);
    }
}

// Récupère les languages utilisés dans le repo
async function getRepoLanguages(owner, repo, token) {
    const url = `https://api.github.com/repos/${owner}/${repo}/languages`;
    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return await response.json();
}

// Analyse remote
async function analyseRemote(owner, repo, token, branch) {
    const languages = await getRepoLanguages(owner, repo, token)
    const allFiles = await getRepoFiles(owner, repo, token, branch);
    const components = new Map();

     // Détection python
    if (languages.Python) {
        // 1. Détecte le dossier de travail
        console.log("- Projet python détecté\n")
        const depFile = allFiles.find(f => f.endsWith('requirements.txt') || f.endsWith('pyproject.toml'));
        const pyDir = depFile ? path.dirname(depFile) : ".";

        // On récupère le contenu du fichier de config à distance pour chercher flake8/pytest
        const depContent = depFile ? await getRawFileContent(owner, repo, depFile, token, branch) : "";

        const pyConfigFile = allFiles.find(f => path.basename(f) === 'config.py');
        const configDir = pyConfigFile ? path.dirname(pyConfigFile) : null;

        // 2. Détection de flake8
        let lintSteps = [];
        if (depContent?.includes('flake8') || allFiles.some(f => f.includes('.flake8'))) {
            lintSteps.push({name: 'Linting flake8', run: 'flake8 . --count --statistics'});
        }

        let testSteps = [];
        const hasRootTestFile = allFiles.includes('tests.py'); // Ton cas spécifique
        const hasAnyTests = allFiles.some(f => f.toLowerCase().includes('test') && f.endsWith('.py'));

        if (hasAnyTests) {
            // On prépare le préfixe PYTHONPATH seulement si un config.py est trouvé hors de la racine
            const pythonPathPrefix = (configDir && configDir !== ".") ? `export PYTHONPATH=$PYTHONPATH:./${configDir} && ` : "";
            
            let runCmd = "";
            if (hasRootTestFile) {
                // Priorité au script de test à la racine (très courant dans les petits projets Flask)
                runCmd = `${pythonPathPrefix}python tests.py`;
            } else if (depContent?.includes('pytest')) {
                runCmd = "pytest";
            } else {
                // Découverte automatique par défaut
                runCmd = `${pythonPathPrefix}python -m unittest discover -v`;
            }

            testSteps.push({
                name: 'Run Python Tests',
                run: runCmd
            });
        }

        components.set('python', {
            template: 'python.yml',
            output: 'python-ci.yml',
            workingDir: pyDir === "." ? "." : pyDir,
            testSteps: testSteps,
            lintSteps: lintSteps
        });
    }

    // Détection Node.js
    if (languages.TypeScript || languages.JavaScript) {
        console.log("- Projet Nodejs détecté\n")
    const packageFiles = allFiles.filter(f => f.endsWith('package.json') && !f.includes('node_modules'));
    for (const pkgPath of packageFiles) {
            const content = await getRawFileContent(owner, repo, pkgPath, token, branch);
            if (!content) continue;

            try {
                const pkg = JSON.parse(content);
                const pkgDir = path.dirname(pkgPath);
                let testSteps = [];
                let lintSteps = [];

                if (pkg.scripts) {
                    if (pkg.scripts.test) {
                        testSteps.push({ name: 'NPM test', run: 'npm test' });
                    }
                    if (pkg.scripts.lint) {
                        lintSteps.push({ name: 'NPM lint', run: 'npm run lint -- --fix' });
                    }
                }

                const suffix = pkgDir === "." ? "root" : pkgDir.replace(/\//g, '-');
                components.set(`node-${pkgPath}`, {
                    template: 'node.yml',
                    output: `node-ci-${suffix}.yml`,
                    workingDir: pkgDir === "." ? "." : pkgDir,
                    testSteps: testSteps,
                    lintSteps: lintSteps
                });
            } catch (e) { console.error("Erreur JSON", pkgPath); }
        }
    }
    return Array.from(components.values());
}

// Génére le worlflow
async function generateAndPushWorkflows(components, owner, repo, token, branch) {
   for (const comp of components) {
        const templatePath = path.join(__dirname, 'templates', comp.template);
        if (!fs.existsSync(templatePath)) continue;

        let content = fs.readFileSync(templatePath, 'utf8');
        content = content.replaceAll('{{WORKING_DIRECTORY}}', comp.workingDir);

        // Génération du YAML pour les tests/lint (logique simplifiée pour l'exemple)
        const lintYaml = comp.lintSteps.length > 0 
            ? comp.lintSteps.map(s => `      - name: ${s.name}\n        run: ${s.run}`).join('\n')
            : "      # No lint detected";
        
        const testYaml = comp.testSteps.length > 0 
            ? comp.testSteps.map(s => `      - name: ${s.name}\n        run: ${s.run}`).join('\n')
            : "      # No tests detected";

        content = content.replace('{{LINT_STEPS}}', lintYaml).replace('{{TEST_STEPS}}', testYaml);

        content = content.replace('{{DEFAULT_BRANCH}}', branch);

        // Envoi direct à GitHub
        const remotePath = `.github/workflows/${comp.output}`;
        await pushFileToGitHub(owner, repo, remotePath, content, token);
    }
}

async function Start() {
    try {
            
            console.log("--- Configuration de l'analyse github ---");
            const owner = await question("Propriétaire du dépôt : ");
            const repo = await question("Nom du repo : ");
            const token = await question("Token github : ");

            console.log(`\n Lancement de l'analyse pour ${owner}/${repo}...\n`);

            const branch = await getDefaultBranch(owner, repo, token);
            console.log('default branch : ',branch)

            const components = await analyseRemote(owner, repo, token, branch);

            if (components.length === 0) {
            console.log("❌ Aucune technologie compatible détectée.");
            return;
        }

            await generateAndPushWorkflows(components, owner, repo, token, branch);

            console.log("\n✅ Tous les workflows ont été envoyés sur GitHub !");
        
    } catch (err) {
        console.error("Erreur système :", err.message);
    }
     finally {
        rl.close();
    }
}

Start();