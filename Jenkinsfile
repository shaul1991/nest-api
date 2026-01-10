pipeline {
    agent any

    parameters {
        choice(name: 'ENVIRONMENT', choices: ['dev', 'production'], description: '배포 환경 선택')
        string(name: 'BRANCH', defaultValue: 'develop', description: '배포할 브랜치')
    }

    environment {
        PROJECT_DIR = '/opt/nest-api'
        DOCKER_IMAGE = 'nest-api'
        GIT_REPO = 'git@github.com:YOUR_USERNAME/nest-api.git'
    }

    stages {
        stage('Checkout') {
            steps {
                script {
                    checkout([
                        $class: 'GitSCM',
                        branches: [[name: "*/${params.BRANCH}"]],
                        userRemoteConfigs: [[
                            url: env.GIT_REPO,
                            credentialsId: 'github-ssh-key'
                        ]]
                    ])
                }
            }
        }

        stage('Copy to Project Dir') {
            steps {
                sh """
                    rsync -av --exclude='.git' --exclude='node_modules' --exclude='dist' \
                        ./ ${PROJECT_DIR}/
                """
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    def tag = params.ENVIRONMENT == 'production' ? 'latest' : 'dev'
                    sh """
                        cd ${PROJECT_DIR}
                        docker build -t ${DOCKER_IMAGE}:${tag} .
                    """
                }
            }
        }

        stage('Deploy') {
            steps {
                script {
                    def composeOverride = params.ENVIRONMENT == 'production'
                        ? 'docker-compose.prod.yml'
                        : 'docker-compose.dev.yml'
                    def envFile = params.ENVIRONMENT == 'production'
                        ? '.env.production'
                        : '.env.dev'

                    sh """
                        cd ${PROJECT_DIR}
                        docker compose -f docker-compose.yml -f ${composeOverride} --env-file ${envFile} down --remove-orphans || true
                        docker compose -f docker-compose.yml -f ${composeOverride} --env-file ${envFile} up -d --build
                    """
                }
            }
        }

        stage('Health Check') {
            steps {
                script {
                    def port = params.ENVIRONMENT == 'production' ? '3100' : '3101'
                    sh """
                        echo "Waiting for application to start..."
                        sleep 15
                        for i in 1 2 3 4 5; do
                            if curl -sf http://localhost:${port}/health/live; then
                                echo "Health check passed!"
                                exit 0
                            fi
                            echo "Attempt \$i failed, retrying..."
                            sleep 5
                        done
                        echo "Health check failed after 5 attempts"
                        exit 1
                    """
                }
            }
        }

        stage('Cleanup') {
            steps {
                sh 'docker image prune -f'
            }
        }
    }

    post {
        success {
            script {
                def domain = params.ENVIRONMENT == 'production'
                    ? 'api-nest.shaul.link'
                    : 'dev-api-nest.shaul.link'
                echo "Deployment to ${params.ENVIRONMENT} successful!"
                echo "Application URL: https://${domain}"
            }
        }
        failure {
            echo "Deployment to ${params.ENVIRONMENT} failed!"
        }
        always {
            cleanWs()
        }
    }
}
