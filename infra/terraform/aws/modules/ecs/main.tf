# CEVOC — ECS Fargate cluster, service and task definition

variable "environment" { type = string }
variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "target_group_arn" { type = string }
variable "alb_security_group_id" { type = string }
variable "image_uri" { type = string }
variable "task_role_arn" { type = string }
variable "execution_role_arn" { type = string }
variable "secret_arn" { type = string }
variable "log_group_name" { type = string }

locals {
  is_prod = var.environment == "prod"
}

data "aws_region" "current" {}

resource "aws_ecs_cluster" "this" {
  name = "cevoc-${var.environment}"

  setting {
    name  = "containerInsights"
    value = local.is_prod ? "enabled" : "disabled"
  }
}

resource "aws_security_group" "tasks" {
  name_prefix = "cevoc-${var.environment}-ecs-"
  description = "CEVOC ECS tasks — accepts 8080 from ALB only"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [var.alb_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "cevoc-${var.environment}-ecs-sg" }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_ecs_task_definition" "this" {
  family                   = "cevoc-${var.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = local.is_prod ? "2048" : "1024"
  memory                   = local.is_prod ? "4096" : "2048"
  task_role_arn            = var.task_role_arn
  execution_role_arn       = var.execution_role_arn

  container_definitions = jsonencode([
    {
      name      = "cevoc"
      image     = var.image_uri
      essential = true
      portMappings = [
        { containerPort = 8080, protocol = "tcp" }
      ]
      environment = [
        { name = "SPRING_PROFILES_ACTIVE", value = var.environment },
        { name = "SECRETS_ARN", value = var.secret_arn },
        { name = "SERVER_PORT", value = "8080" },
        { name = "CEVOC_DEMO_DATA_ENABLED", value = "true" },
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = var.log_group_name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "cevoc"
        }
      }
      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:8080/actuator/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])
}

resource "aws_ecs_service" "this" {
  name            = "cevoc-${var.environment}"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.this.arn
  desired_count   = local.is_prod ? 2 : 1
  launch_type     = "FARGATE"

  network_configuration {
    assign_public_ip = false
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.tasks.id]
  }

  load_balancer {
    container_name   = "cevoc"
    container_port   = 8080
    target_group_arn = var.target_group_arn
  }

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  lifecycle {
    ignore_changes = [desired_count] # Allow autoscaling to manage
  }
}

output "cluster_arn" {
  value = aws_ecs_cluster.this.arn
}

output "cluster_name" {
  value = aws_ecs_cluster.this.name
}

output "service_name" {
  value = aws_ecs_service.this.name
}
