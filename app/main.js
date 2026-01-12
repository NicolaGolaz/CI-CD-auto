const fs = require('fs');
const path = require('path');
const https =  require('https');


function analyseLocal(rootDir) {
    const report = {
        languages: [],
        hasTests: false,
        testCommand: '',
        configTemplate: 'generic.yml'
    };

    // Chemins des fichiers clés
    const paths = {
        requirements: path.join(rootDir, 'requirements.txt'),
        pyproject: path.join(rootDir, 'pyproject.toml'),
        tox: path.join(rootDir, 'tox.ini'),
        pytestIni: path.join(rootDir, 'pytest.ini'),
        testFolder: path.join(rootDir, 'tests')
    };

    // Détection python
    if (fs.existsSync(paths.requirements) || fs.existsSync(paths.pyproject)) {
        report.languages.push('Python');
        report.configTemplate = 'python.yml';

        if (fs.existsSync(paths.tox)) {
            report.hasTests = true;
            report.testCommand = 'tox'; 
        }

        if (fs.existsSync(paths.pytestIni)) {
            report.hasTests = true;
            report.testCommand = 'pytest'; 
        }

        // Détection de tests basique
        if (fs.existsSync(paths.requirements)) {
            let reqContent = fs.readFileSync(paths.requirements, 'utf8')
            if (reqContent.includes('pytest')){
                report.hasTests = true;
                report.testCommand = 'pytest'
            }
        }
    }
    
    // Ajouté la détéction nodejs plus tard
    return report;
}

function generateWorkflow(data, targetDir) {
    const workflowDir = path.join(targetDir, '.github', 'workflows');
    
    const template = path.join(__dirname, 'templates', data.configTemplate);
    if (!fs.existsSync(template)) {
        console.log(`Template ${data.configTemplate} non trouvé, utilisation d'un contenu par défaut.`);
        fs.writeFileSync(path.join(workflowDir, 'main.yml'), "# Workflow générique\nname: CI");
        return;
    }

    let content = fs.readFileSync(template, 'utf8');

    const testStep = data.hasTests 
    ? `- name: Run tests\n        run: ${data.testCommand}`
    : "# Aucun tests détecté"

    content = content.replace('{{TEST_STEP}}', testStep);

    fs.writeFileSync(path.join(workflowDir, 'main.yml'), content);
    console.log(`Workflow ajouté avec succès dans ${workflowDir} via ${data.configTemplate}`)
}

async function Start() {
    const target = process.argv[2];
    try {
    if (!target || target === 'local')
    {
        console.log("Analyse du dépot local...")
        const rootDir = path.join(__dirname, '..');
        const data = analyseLocal(rootDir);
        generateWorkflow(data, rootDir);
    } else 
    {
        console.log(`Analyse du dépôt distant : ${target} ...`)
        const data = await analyseRemote(target)
        console.log("Données récupérées via API:", data);
        generateWorkflow(data, process.cwd());
    }
}
catch (err) {
    console.error("Une erreur est survenu : ", err)
}
}

Start();