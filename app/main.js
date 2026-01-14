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
        
        const firstPyFile = pythonFiles[0];
        const pyDir = path.dirname(firstPyFile)

        let relativeDir = path.relative(rootDir, pyDir).replace(/\\/g, '/') || ".";

        // 1. Cherche si des tests python existe
        const hasPytestConfig = allFiles.some(f => 
            f.endsWith('pytest.ini') || f.endsWith('conftest.py') || f.endsWith('tox.ini')
        );

        const usesPytestInDeps = allFiles.some(f => {
            if (f.endsWith('requirements.txt') || f.endsWith('pyproject.toml')) {
                const content = fs.readFileSync(f, 'utf8');
                return content.includes('pytest');
            }
            return false;
        });

        // 2. Cherche la présence de fichiers de tests
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
            testSteps: testSteps,
            workingDir: relativeDir
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