# AWS Deployment Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CloudFront                                 │
│                    (CDN + HTTPS termination)                        │
└─────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┴───────────────────────────┐
        │                                                       │
        ▼                                                       ▼
┌───────────────────┐                               ┌───────────────────┐
│        S3         │                               │    ALB / NLB      │
│   (React SPA)     │                               │                   │
└───────────────────┘                               └───────────────────┘
                                                            │
                                                            ▼
                                                ┌───────────────────┐
                                                │   ECS Fargate     │
                                                │   (Node API)      │
                                                │                   │
                                                │   ┌───────────┐   │
                                                │   │ Container │   │
                                                │   │   API     │   │
                                                │   └───────────┘   │
                                                └───────────────────┘
                                                            │
        ┌───────────────────────────────────────────────────┤
        │                                                   │
        ▼                                                   ▼
┌───────────────────┐                           ┌───────────────────┐
│   RDS PostgreSQL  │                           │ Secrets Manager   │
│   (Primary +      │                           │ (JWT secrets,     │
│    Read Replica)  │                           │  DB credentials)  │
└───────────────────┘                           └───────────────────┘
```

## Prerequisites

1. AWS CLI configured
2. Docker installed
3. Domain name (optional, for custom domain)
4. SSL certificate in AWS Certificate Manager (optional)

## Step 1: Database Setup (RDS PostgreSQL)

### Create DB Subnet Group

```bash
aws rds create-db-subnet-group \
  --db-subnet-group-name fundroom-erp-db-subnet \
  --db-subnet-group-description "Fundroom ERP database subnet" \
  --subnet-ids subnet-xxx subnet-yyy subnet-zzz
```

### Create RDS Instance

```bash
aws rds create-db-instance \
  --db-instance-identifier fundroom-erp-db \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 16 \
  --master-username fundroom_admin \
  --master-user-password <secure-password> \
  --allocated-storage 20 \
  --storage-encrypted \
  --db-subnet-group-name fundroom-erp-db-subnet \
  --vpc-security-group-ids sg-xxx \
  --backup-retention-period 7 \
  --deletion-protection
```

### Connection String

```
DATABASE_URL="postgresql://fundroom_admin:<password>@<endpoint>:5432/fundroom_erp?schema=public"
```

## Step 2: Secrets Management

### Store Secrets in AWS Secrets Manager

```bash
# Database credentials
aws secretsmanager create-secret \
  --name fundroom-erp/database-url \
  --secret-string "postgresql://fundroom_admin:<password>@<endpoint>:5432/fundroom_erp?schema=public"

# JWT secret
aws secretsmanager create-secret \
  --name fundroom-erp/jwt-secret \
  --secret-string "<generate-secure-random-string>"
```

## Step 3: ECR (Container Registry)

### Create Repository

```bash
aws ecr create-repository \
  --repository-name fundroom-erp-api \
  --image-scanning-configuration scanOnPush=true
```

### Build and Push Image

```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com

# Build image
docker build -t fundroom-erp-api ./apps/api

# Tag and push
docker tag fundroom-erp-api:latest <account>.dkr.ecr.us-east-1.amazonaws.com/fundroom-erp-api:latest
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/fundroom-erp-api:latest
```

## Step 4: ECS Fargate

### Create ECS Cluster

```bash
aws ecs create-cluster --cluster-name fundroom-erp-cluster
```

### Task Definition

Create `task-definition.json`:

```json
{
  "family": "fundroom-erp-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::<account>:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::<account>:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "api",
      "image": "<account>.dkr.ecr.us-east-1.amazonaws.com/fundroom-erp-api:latest",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        { "name": "NODE_ENV", "value": "production" },
        { "name": "PORT", "value": "3000" }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:<account>:secret:fundroom-erp/database-url"
        },
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:<account>:secret:fundroom-erp/jwt-secret"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/fundroom-erp-api",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

### Register Task Definition

```bash
aws ecs register-task-definition --cli-input-json file://task-definition.json
```

### Create Service

```bash
aws ecs create-service \
  --cluster fundroom-erp-cluster \
  --service-name fundroom-erp-api \
  --task-definition fundroom-erp-api \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy],securityGroups=[sg-xxx],assignPublicIp=DISABLED}" \
  --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:us-east-1:<account>:targetgroup/fundroom-erp-api/xxx,containerName=api,containerPort=3000"
```

## Step 5: Load Balancer

### Create Application Load Balancer

```bash
aws elbv2 create-load-balancer \
  --name fundroom-erp-alb \
  --subnets subnet-xxx subnet-yyy \
  --security-groups sg-xxx
```

### Create Target Group

```bash
aws elbv2 create-target-group \
  --name fundroom-erp-api \
  --protocol HTTP \
  --port 3000 \
  --vpc-id vpc-xxx \
  --target-type ip \
  --health-check-path /health
```

## Step 6: Frontend Deployment (S3 + CloudFront)

### Create S3 Bucket

```bash
aws s3 mb s3://fundroom-erp-web
aws s3 website s3://fundroom-erp-web --index-document index.html --error-document index.html
```

### Build and Deploy React App

```bash
cd apps/web
npm run build
aws s3 sync dist/ s3://fundroom-erp-web --delete
```

### Create CloudFront Distribution

```bash
aws cloudfront create-distribution \
  --distribution-config file://cloudfront-config.json
```

## Step 7: Run Migrations

Before deploying, run Prisma migrations:

```bash
# Set DATABASE_URL from Secrets Manager
export DATABASE_URL=$(aws secretsmanager get-secret-value --secret-id fundroom-erp/database-url --query SecretString --output text)

# Run migrations
npx prisma migrate deploy

# Run seed
npx prisma db seed
```

## Environment Variables

| Variable | Source | Description |
|----------|--------|-------------|
| `DATABASE_URL` | Secrets Manager | PostgreSQL connection string |
| `JWT_SECRET` | Secrets Manager | Secret for JWT signing |
| `JWT_EXPIRES_IN` | Task Definition | Token expiry (e.g., "15m") |
| `NODE_ENV` | Task Definition | "production" |
| `PORT` | Task Definition | 3000 |
| `CORS_ORIGIN` | Task Definition | CloudFront URL |

## CI/CD Pipeline (GitHub Actions)

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Login to ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push API
        run: |
          docker build -t ${{ steps.login-ecr.outputs.registry }}/fundroom-erp-api:${{ github.sha }} ./apps/api
          docker push ${{ steps.login-ecr.outputs.registry }}/fundroom-erp-api:${{ github.sha }}

      - name: Update ECS service
        run: |
          aws ecs update-service \
            --cluster fundroom-erp-cluster \
            --service fundroom-erp-api \
            --force-new-deployment

      - name: Build and deploy frontend
        run: |
          cd apps/web
          npm run build
          aws s3 sync dist/ s3://fundroom-erp-web --delete
          aws cloudfront create-invalidation --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} --paths "/*"
```

## Monitoring & Logging

### CloudWatch Logs

Logs are automatically sent to CloudWatch via the `awslogs` driver.

### CloudWatch Alarms

```bash
# High error rate
aws cloudwatch put-metric-alarm \
  --alarm-name fundroom-erp-high-error-rate \
  --metric-name 5XXError \
  --namespace AWS/ApplicationELB \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2
```

## Security Checklist

- [ ] RDS encryption enabled
- [ ] Secrets stored in Secrets Manager
- [ ] VPC with private subnets for ECS tasks
- [ ] Security groups restrict access
- [ ] HTTPS enabled via ALB/CloudFront
- [ ] IAM roles follow least privilege
- [ ] Container image scanning enabled
