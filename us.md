# User Stories

## US-01 : Création de dossiers/fichiers

**En tant qu’** Utilisateur
**Je veux** que les dossiers et fichiers nécessaires au fonctionnement du ou des workflow(s) soient créés s'ils n'existent pas déjà
**Afin de** permettre au workflow de fonctionner correctement.

* **Étant donné** que je suis à la racine de mon repository
* **Quand** je clique sur le fichier de mise en place des pipelines
* **Alors** les dossiers et fichiers nécessaires au fonctionnement du/des workflow(s) sont créés s'ils n'existent pas déjà (ex: `.github`, `workflows`, etc.).

---

## US-02 : Détection des language

**En tant qu’** Utilisateur
**Je veux** que l'outil détecte les languages utilisées dans le repository
**Afin de** pouvoir créer les workflows en fonction.

* **Étant donné** que je suis à la racine de mon repository
* **Quand** je clique sur le fichier de mise en place des pipelines
* **Alors** l'outil récupère les language (js, c#, python, etc.) utilisées dans le repository via l'api GitHub.

---

## US-03 : Détection des technologies

**En tant qu’** Utilisateur
**Je veux** que l'outil détecte les technologies utilisées dans le repository
**Afin de** pouvoir créer les workflows en fonction.

* **Étant donné** que je suis à la racine de mon repository
* **Quand** je clique sur le fichier de mise en place des pipelines
* **Alors** l'outil récupère les technologies (Vite, React, Express, etc.) utilisées dans le repository

## US-04 : Sélection d'un fichier template

**En tant qu’** Utilisateur
**Je veux** que l'outil utilise plusieurs fichier template predéfini
**Afin de** pouvoir choisir le plus adapté.

* **Étant donné** que je suis à la racine de mon repository
* **Quand** je clique sur le fichier de mise en place des pipelines
* **Alors** l'outil sélectionne le template approprié en fonction des données récupérées sur le repository

## US-05 : Détection de tests

**En tant qu’** Utilisateur
**Je veux** que l'outil détecte la présence de tests (et leur technologie) dans le repository
**Afin de** pouvoir les éxecuter dans le workflows.

* **Étant donné** que je suis à la racine de mon repository
* **Quand** je clique sur le fichier de mise en place des pipelines
* **Alors** l'outil détecte la présence de tests dans le repository, et leurs technologie (pytest, unittest) et ajoute leurs exécution dans le workflow