const fs = require('fs');
const path = require('path');

const scriptFolderName = path.basename(__dirname)

// Récupère les fichiers du repos en ignorant les fichier du script
function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];

    files.forEach(file => {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (![scriptFolderName, 'node_modules', '.git', 'venv', '.venv'].includes(file)) {
                arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
            }
        } else {
            arrayOfFiles.push(fullPath);
        }
    });
    return arrayOfFiles;
}

// Analyse local
function analyseLocal(rootDir) {
    const allFiles = getAllFiles(rootDir);
    const components = new Map();

     // Détection python
    const pythonFiles = allFiles.filter(f => f.endsWith('.py'));
    if (pythonFiles.length > 0) {
        let testCommand = "";
        
        // 1. Détecte le dossier de travail
        const pyDir = path.dirname(allFiles.find(f => 
        f.endsWith('requirements.txt') || f.endsWith('pyproject.toml')    
        ))
        let relativeDir = path.relative(rootDir, pyDir).replace(/\\/g, '/') || ".";


        // 2. Détection de flake8
        const hasConfigFile = allFiles.some(f => path.basename(f) === '.flake8');
        
        const hasSharedConfig = allFiles.some(f => {
            const name = path.basename(f);
            if (name === 'setup.cfg' || name === 'tox.ini'){
                const content = fs.readFileSync(f, 'utf8');
                return content.includes('[flake8]');
            }
            return false;
        })

        const hasFlake8InDeps = allFiles.some(f => {
            const name = path.basename(f);
            if (['requirements.txt', 'dev-requirements.txt', 'requirements-dev.txt', 'pyproject.toml'].includes(name)){
                const content = fs.readFileSync(f, 'utf8')
                return /\bflake8\b/.test(content);
            }
            return false;
        })
        
        let lintSteps = []
        if (hasConfigFile || hasSharedConfig || hasFlake8InDeps) {
        lintSteps = [{name: 'Linting du code avec flake8', run: 'flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics'}];
        }
        // 3. Cherche si des tests python existe
        const hasPytestConfig = allFiles.some(f => 
            f.endsWith('pytest.ini') || f.endsWith('conftest.py') || f.endsWith('tox.ini')
        );

        const usesPytestInDeps = allFiles.some(f => {
            if (f.endsWith('requirements.txt') || f.endsWith('pyproject.toml') || f.endsWith('dev-requirements.txt') || f.endsWith('requirements-dev.txt')) {
                const content = fs.readFileSync(f, 'utf8');
                return content.includes('pytest');
            }
            return false;
        });

        // 4. Cherche la présence de fichiers de tests
        const hasTestFiles = allFiles.some(f => {
            const name = path.basename(f).toLowerCase();
            return name.includes('test') && name.endsWith('.py');
        });

        if (hasTestFiles) {
            if (hasPytestConfig || usesPytestInDeps) {
                // On sait que c'est Pytest
                testCommand = "pytest";
            } else {
                // Par défaut on utilise Unittest
                testCommand = "python -m unittest discover -p '*test*.py'";
            }
        }

        const testSteps = testCommand ? [{ name: `Run ${testCommand.split(' ')[0]}`, run: testCommand }] : [];

        components.set('python', {
            template: 'python.yml',
            output: 'python-ci.yml',
            workingDir: relativeDir,
            testSteps: testSteps,
            lintSteps: lintSteps
        });
    }

    return Array.from(components.values());
}

// Génére le worlflow
function generateWorkflows(components, rootDir) {
    const workflowDir = path.join(rootDir, '.github', 'workflows');
    if (!fs.existsSync(workflowDir)) fs.mkdirSync(workflowDir, { recursive: true });

    components.forEach(comp => {
        const templatePath = path.join(__dirname, 'templates', comp.template);
        if (!fs.existsSync(templatePath)) return;

        let content = fs.readFileSync(templatePath, 'utf8');
        
        // Ajout du dossier de travaille
        content = content.replace('{{WORKING_DIRECTORY}}', comp.workingDir);

        // Ajout des étapes de linting du code
        let lintYaml = comp.lintSteps.length > 0
            ? comp.lintSteps.map(s => `      - name: ${s.name}\n        run: ${s.run}`).join('\n')
            : "      # Outil de linting nom détecté";

        content = content.replace('{{LINT_STEPS}}', lintYaml);

        // Ajout des étapes d'éxecution des tests
        let testYaml = comp.testSteps.length > 0 
            ? comp.testSteps.map(s => `      - name: ${s.name}\n        run: ${s.run}`).join('\n')
            : "      # Aucun test détecté";

        content = content.replace('{{TEST_STEPS}}', testYaml);

        fs.writeFileSync(path.join(workflowDir, comp.output), content);
        console.log(`Workflow généré : ${comp.output}`);
    });
}

async function Start() {
    // const target = process.argv[2] || 'local'; Pour le mode api
    try {
            const rootDir = path.join(__dirname, '..'); // Remonte d'un cran
            console.log(`Analyse du dossier : ${path.resolve(rootDir)}`);
            const components = analyseLocal(rootDir);
            generateWorkflows(components, rootDir);
        
    } catch (err) {
        console.error("Erreur système :", err.message);
    }
}

Start();