# CEVOC — Secrets Manager + IAM roles for ECS tasks

variable "environment" { type = string }

resource "aws_secretsmanager_secret" "app" {
  name        = "cevoc/${var.environment}/app"
  description = "CEVOC ${var.environment} application secrets (API keys, connection strings)"
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    REVENUE_NSW_API_KEY  = "CHANGE_ME"
    DB_CONNECTION_STRING = "CHANGE_ME"
  })

  lifecycle {
    ignore_changes = [secret_string] # Don't overwrite secrets set via console/CLI
  }
}

# ---------- Task Role (app code) ----------
data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "task" {
  name               = "cevoc-${var.environment}-task-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy" "read_secrets" {
  name = "ReadSecrets"
  role = aws_iam_role.task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = aws_secretsmanager_secret.app.arn
      }
    ]
  })
}

# ---------- Execution Role (ECS agent: pull images, push logs) ----------
resource "aws_iam_role" "execution" {
  name               = "cevoc-${var.environment}-execution-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy_attachment" "ecs_exec" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ---------- Outputs ----------
output "secret_arn" {
  value = aws_secretsmanager_secret.app.arn
}

output "task_role_arn" {
  value = aws_iam_role.task.arn
}

output "execution_role_arn" {
  value = aws_iam_role.execution.arn
}
