# CEVOC — CloudWatch log group and alarms

variable "environment" { type = string }
variable "cluster_name" {
  type    = string
  default = ""
}
variable "service_name" {
  type    = string
  default = ""
}

locals {
  is_prod     = var.environment == "prod"
  has_service = var.service_name != ""
}

resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/cevoc-${var.environment}"
  retention_in_days = local.is_prod ? 90 : 14
}

# ---------- Alarm topic (prod) ----------
resource "aws_sns_topic" "alarms" {
  count = local.is_prod ? 1 : 0
  name  = "cevoc-${var.environment}-alarms"
}

# ---------- CPU alarm ----------
resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  count               = local.has_service ? 1 : 0
  alarm_name          = "cevoc-${var.environment}-cpu-high"
  alarm_description   = "ECS CPU utilisation above 80% for 5 minutes"
  namespace           = "AWS/ECS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"

  dimensions = {
    ClusterName = var.cluster_name
    ServiceName = var.service_name
  }

  alarm_actions = local.is_prod && length(aws_sns_topic.alarms) > 0 ? [aws_sns_topic.alarms[0].arn] : []
}

# ---------- Memory alarm ----------
resource "aws_cloudwatch_metric_alarm" "memory_high" {
  count               = local.has_service ? 1 : 0
  alarm_name          = "cevoc-${var.environment}-memory-high"
  alarm_description   = "ECS memory utilisation above 85% for 5 minutes"
  namespace           = "AWS/ECS"
  metric_name         = "MemoryUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = 85
  comparison_operator = "GreaterThanThreshold"

  dimensions = {
    ClusterName = var.cluster_name
    ServiceName = var.service_name
  }
}

output "log_group_name" {
  value = aws_cloudwatch_log_group.ecs.name
}
