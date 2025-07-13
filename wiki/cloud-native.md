Core AWS Cloud-Native Principles:

1. Serverless-First Architecture

   - AWS Lambda for compute
   - API Gateway for REST/GraphQL APIs
   - DynamoDB for NoSQL data
   - S3 for object storage
   - Step Functions for orchestration

2. Managed Services Over Self-Managed

   - RDS/Aurora instead of EC2-hosted databases
   - ECS instead of self-managed containers
   - ElastiCache instead of self-hosted Redis
   - Amazon MQ instead of self-hosted message brokers

3. AWS-Native Scaling

   - Lambda automatic scaling
   - DynamoDB on-demand scaling
   - Application Load Balancer (ALB) for distribution

4. Security & IAM Integration

   - IAM roles and policies for service-to-service auth
   - AWS Secrets Manager/Parameter Store
   - KMS for encryption
   - Security Groups and NACLs for network isolation

5. Event-Driven Architecture

   - EventBridge for event routing
   - SNS/SQS for decoupling
   - Kinesis for streaming
   - Lambda triggers from S3, DynamoDB, etc.

6. Infrastructure as Code

   - CDK
   - Service Catalog for approved resources
   - AWS SAM for serverless apps

7. Observability

   - CloudWatch for metrics/logs
   - X-Ray for distributed tracing
   - CloudWatch Insights for analysis
   - AWS Cost Explorer for spend tracking

8. Multi-Region & High Availability

   - Multi-AZ deployments by default
   - Route 53 for DNS and failover
   - CloudFront for global CDN
   - S3 cross-region replication
