# Deployment

How to deploy Vaultr to production with security, scalability, and reliability.

## Pre-Deployment Checklist

### Security

- [ ] All secrets generated and stored securely (AWS Secrets Manager)
- [ ] JWT_SECRET minimum 32 characters
- [ ] Database password strong (20+ characters, mixed case + symbols)
- [ ] HTTPS enforced (TLS 1.2+)
- [ ] CORS configured (explicit allowed origins)
- [ ] Security headers set (CSP, X-Frame-Options, etc.)
- [ ] Rate limiting configured (Redis, not in-memory)
- [ ] Email verification required before sensitive operations
- [ ] Audit logging enabled
- [ ] Monitoring/alerting configured

### Infrastructure

- [ ] PostgreSQL database provisioned and backed up
- [ ] Redis cache provisioned (if using rate limiting)
- [ ] SMTP email service configured (AWS SES, Mailgun, etc.)
- [ ] Firewall rules restrict database access
- [ ] CDN/caching configured (if applicable)
- [ ] Monitoring dashboards set up
- [ ] Log aggregation configured (CloudWatch, DataDog, etc.)
- [ ] Domain SSL certificate obtained
- [ ] DNS records updated

### Application

- [ ] All tests passing (`npm run ci`)
- [ ] TypeScript compiles without errors (`npm run typecheck`)
- [ ] Linting passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Environment variables documented
- [ ] Database migrations tested on staging
- [ ] Rollback plan documented

---

## Environment Setup

### 1. Provision Database

#### AWS RDS PostgreSQL

```bash
# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier vaultr-prod \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 14.7 \
  --master-username vaultr \
  --master-user-password "<strong-password>" \
  --allocated-storage 100 \
  --backup-retention-period 30 \
  --multi-az \
  --publicly-accessible false

# Get endpoint
aws rds describe-db-instances \
  --db-instance-identifier vaultr-prod \
  --query 'DBInstances[0].Endpoint.Address'
```

#### Connection String

```bash
DATABASE_URL="postgresql://vaultr:${PASSWORD}@vaultr-prod.c9akciq32.us-east-1.rds.amazonaws.com:5432/vaultr"
```

---

### 2. Provision Redis Cache

#### AWS ElastiCache

```bash
aws elasticache create-cache-cluster \
  --cache-cluster-id vaultr-cache \
  --engine redis \
  --cache-node-type cache.t3.micro \
  --engine-version 7.0 \
  --num-cache-nodes 1 \
  --preferred-availability-zone us-east-1a

# Get endpoint
aws elasticache describe-cache-clusters \
  --cache-cluster-id vaultr-cache \
  --query 'CacheClusters[0].CacheNodes[0].Address'
```

#### Connection String

```bash
REDIS_URL="redis://vaultr-cache.abc123.ng.0001.use1.cache.amazonaws.com:6379"
```

---

### 3. Configure Email Service

#### AWS SES

```bash
# Verify domain
aws ses verify-domain-identity --domain vaultr.app

# Check verification status
aws ses get-identity-verification-attributes \
  --identities vaultr.app

# Create SMTP credentials
aws iam create-user --user-name vaultr-ses
aws iam create-access-key --user-name vaultr-ses

# Get SMTP endpoint
# Region: us-east-1 → email-smtp.us-east-1.amazonaws.com
```

#### Environment Variables

```bash
SMTP_HOST="email-smtp.us-east-1.amazonaws.com"
SMTP_PORT=587
SMTP_USER="<AWS SES SMTP username>"
SMTP_PASS="<AWS SES SMTP password>"
SMTP_FROM="noreply@vaultr.app"
SMTP_SECURE=false
```

---

## Build & Deployment

### 1. Build Docker Image

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build
RUN npm run build

# Expose port
EXPOSE 3000

# Start
CMD ["npm", "start"]
```

Build and push:

```bash
docker build -t vaultr:latest .
docker tag vaultr:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/vaultr:latest
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/vaultr:latest
```

### 2. Deploy to AWS ECS

#### Task Definition

```json
{
  "family": "vaultr",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [
    {
      "name": "vaultr",
      "image": "123456789.dkr.ecr.us-east-1.amazonaws.com/vaultr:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "hostPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "NEXT_PUBLIC_BASE_URL",
          "value": "https://vaultr.app"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:vaultr/DATABASE_URL"
        },
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:vaultr/JWT_SECRET"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/vaultr",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

Create service:

```bash
aws ecs create-service \
  --cluster vaultr-prod \
  --service-name vaultr \
  --task-definition vaultr:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --load-balancers targetGroupArn=arn:aws:elasticloadbalancing:...,containerName=vaultr,containerPort=3000
```

---

### 3. Deploy to Kubernetes

#### Deployment Manifest

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vaultr
spec:
  replicas: 2
  selector:
    matchLabels:
      app: vaultr
  template:
    metadata:
      labels:
        app: vaultr
    spec:
      containers:
      - name: vaultr
        image: vaultr:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: NEXT_PUBLIC_BASE_URL
          value: "https://vaultr.app"
        envFrom:
        - secretRef:
            name: vaultr-secrets
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            cpu: 250m
            memory: 512Mi
          limits:
            cpu: 500m
            memory: 1Gi
---
apiVersion: v1
kind: Service
metadata:
  name: vaultr
spec:
  selector:
    app: vaultr
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

Deploy:

```bash
kubectl apply -f deployment.yaml
```

---

## Database Migrations

### Run Migrations

Before deploying, ensure database migrations applied:

```bash
# Connect to production database
npx prisma migrate deploy \
  --skip-generate

# Verify migration status
npx prisma migrate status
```

### Backup Before Migration

```bash
# Create snapshot
aws rds create-db-snapshot \
  --db-instance-identifier vaultr-prod \
  --db-snapshot-identifier vaultr-prod-$(date +%Y%m%d-%H%M%S)
```

---

## Monitoring & Alerts

### CloudWatch Monitoring

```bash
# Create custom metric for errors
aws cloudwatch put-metric-alarm \
  --alarm-name vaultr-error-rate \
  --alarm-description "Alert if error rate exceeds 5%" \
  --metric-name ErrorCount \
  --namespace ECS/vaultr \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 50 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions arn:aws:sns:us-east-1:123456789:alerts
```

### Application Performance Monitoring

Integrate with Datadog, New Relic, or similar:

```typescript
// app/lib/monitoring.ts
import { StatsD } from 'node-statsd'

const statsd = new StatsD({
  host: process.env.DATADOG_HOST,
  port: 8125
})

export function recordMetric(name: string, value: number) {
  statsd.gauge(name, value)
}

export function recordDuration(operation: string, duration: number) {
  statsd.timing(`${operation}.duration`, duration)
}
```

---

## Health Checks

### Liveness Probe

```typescript
// GET /api/health
export async function GET() {
  return NextResponse.json({ status: 'healthy' }, { status: 200 })
}
```

### Readiness Probe

```typescript
// GET /api/ready
export async function GET() {
  try {
    // Check database
    await db.$queryRaw`SELECT 1`
    
    // Check Redis
    await redis.ping()
    
    return NextResponse.json({ ready: true }, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { ready: false, error: 'Dependencies unavailable' },
      { status: 503 }
    )
  }
}
```

---

## Security Headers

### Content Security Policy (CSP)

```typescript
// middleware.ts
const csp = `
  default-src 'self';
  script-src 'self' 'wasm-unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self';
  connect-src 'self';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
`

export function middleware(req: NextRequest) {
  const response = NextResponse.next()
  response.headers.set('Content-Security-Policy', csp)
  return response
}
```

### Other Security Headers

```typescript
response.headers.set('X-Content-Type-Options', 'nosniff')
response.headers.set('X-Frame-Options', 'DENY')
response.headers.set('X-XSS-Protection', '1; mode=block')
response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
```

---

## SSL/TLS Certificate

### Let's Encrypt (Free)

```bash
certbot certonly --dns-route53 \
  --dns-route53-propagation-seconds 30 \
  -d vaultr.app -d www.vaultr.app
```

### AWS Certificate Manager (Free)

```bash
aws acm request-certificate \
  --domain-name vaultr.app \
  --subject-alternative-names www.vaultr.app \
  --validation-method DNS
```

---

## Rollback Plan

### Zero-Downtime Deployment

Use blue-green deployment:

```bash
# Deploy new version (blue)
kubectl apply -f deployment-new.yaml

# Wait for readiness
kubectl wait --for=condition=available --timeout=300s deployment/vaultr-new

# Switch traffic to new version
kubectl patch service vaultr \
  -p '{"spec":{"selector":{"version":"new"}}}'

# If issues, rollback
kubectl patch service vaultr \
  -p '{"spec":{"selector":{"version":"old"}}}'

# Clean up old version
kubectl delete deployment vaultr-old
```

### Database Rollback

If migration fails:

```bash
# Restore from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier vaultr-prod-restore \
  --db-snapshot-identifier vaultr-prod-$(date +%Y%m%d)
```

---

## Disaster Recovery

### Backup Strategy

```bash
# Daily database backup
0 2 * * * aws rds create-db-snapshot \
  --db-instance-identifier vaultr-prod \
  --db-snapshot-identifier vaultr-prod-daily-$(date +%Y%m%d)

# Keep last 30 days
# Delete older snapshots
aws rds describe-db-snapshots \
  --query 'DBSnapshots[?CreateTime<`2024-01-01`].DBSnapshotIdentifier'
```

### Recovery Time Objective (RTO)

Target: 1 hour maximum downtime

### Recovery Point Objective (RPO)

Target: 24 hours maximum data loss

---

## Performance Optimization

### Caching

```typescript
// Cache static assets
response.headers.set('Cache-Control', 'public, max-age=31536000, immutable')

// Cache API responses
response.headers.set('Cache-Control', 'private, max-age=300')
```

### Database Connection Pooling

```bash
# Connection pool settings for Prisma
DATABASE_URL="postgresql://...?schema=public&pool_size=20&max_overflow=10"
```

### CDN for Static Assets

```bash
# CloudFront distribution for /public
aws cloudfront create-distribution \
  --origin-domain-name vaultr.app \
  --default-root-object index.html
```

---

## Production Runbook

### Daily Checks

- [ ] Health check endpoint returns 200
- [ ] No excessive error rates in logs
- [ ] Database backup completed
- [ ] Rate limiting working (check Redis)
- [ ] Email service operational

### Incident Response

1. **Detect**: Monitor alerts trigger
2. **Assess**: Check logs, metrics, health
3. **Mitigate**: Scale up, disable feature, or rollback
4. **Resolve**: Fix issue, test, redeploy
5. **Post-Mortem**: Document, update runbook

---

See also:
- [Environment Variables](./environment-variables.md) — Configuration reference
- [Security Model](./security-model.md) — Security hardening
- [Getting Started](./getting-started.md) — Local development setup
