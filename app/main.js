const fs = require('fs');
const path = require('path');
const https =  require('https');


function analyseLocal(rootDir) {
    const report = {
        languages: [],
        hasTests: false,
        configTemplate: 'generic.yml'
    };

    // Détection Python
    const hasRequirements = fs.existsSync(path.join(rootDir, 'requirements.txt'));

    if (hasRequirements) {
        report.languages.push('Python');
        report.configTemplate = 'python.yml';

        // Détection de tests basique
        if (fs.existsSync(path.join(rootDir, 'tests.py')) || fs.existsSync(path.join(rootDir, 'pytest.ini'))) {
            report.hasTests = true;
        }
    }
    
    // Ajouté la détéction nodejs plus tard
    return report;
}

function generateWorkflow(data, targetDir) {
    const workflowDir = path.join(targetDir, '.github', 'workflows');
    
    const template = path.join(__dirname, 'templates', data.configTemplate);
    if ()
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