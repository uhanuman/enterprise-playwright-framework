pipeline {
    agent any

    environment {
        ENVIRONMENT = 'dev'
        OUTPUT_DIR = 'output'
        LOG_LEVEL = 'info'
        REDACT_SECRETS = 'true'
        WORKERS = '4'
        ENABLE_AI = 'false'
        CI = 'true'
        NODE_ENV = 'test'
    }

    stages {
        stage('Install') {
            steps {
                sh 'npm ci'
                sh 'npx playwright install --with-deps chromium'
            }
        }
        stage('Lint') {
            steps {
                sh 'npm run lint'
            }
        }
        stage('Security Scan') {
            steps {
                sh 'npm run security:scan'
            }
        }
        stage('Run Tests') {
            steps {
                sh 'npx playwright test --workers=${WORKERS}'
                sh 'npm run test:bdd'
            }
        }
        stage('Quality Gate') {
            steps {
                sh 'npm run quality:gate'
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: 'output/**', fingerprint: true
            junit 'output/**/junit.xml'
            junit 'output/**/bdd-junit.xml'
            publishHTML target: [
                allowMissing: true,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: 'output/reports',
                reportFiles: 'index.html',
                reportName: 'Playwright HTML Report'
            ]
        }
        failure {
            echo 'Pipeline failed. Inspect the archived Playwright artifacts for details.'
        }
    }
}