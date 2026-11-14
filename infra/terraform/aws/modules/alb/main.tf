# CEVOC — Application Load Balancer with HTTPS listener

variable "environment" { type = string }
variable "vpc_id" { type = string }
variable "public_subnet_ids" { type = list(string) }
variable "certificate_arn" {
  type    = string
  default = ""
}

locals {
  has_cert = var.certificate_arn != ""
}

resource "aws_security_group" "alb" {
  name_prefix = "cevoc-${var.environment}-alb-"
  description = "CEVOC ALB — accepts HTTPS from the internet"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "cevoc-${var.environment}-alb-sg" }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_lb" "this" {
  name               = "cevoc-${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  subnets            = var.public_subnet_ids
  security_groups    = [aws_security_group.alb.id]
}

resource "aws_lb_target_group" "this" {
  name        = "cevoc-${var.environment}-tg"
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = "/actuator/health"
    interval            = 30
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

# HTTPS listener (only when cert provided)
resource "aws_lb_listener" "https" {
  count             = local.has_cert ? 1 : 0
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this.arn
  }
}

# HTTP listener — redirect to HTTPS when cert present, forward otherwise (dev)
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = local.has_cert ? "redirect" : "forward"

    dynamic "redirect" {
      for_each = local.has_cert ? [1] : []
      content {
        protocol    = "HTTPS"
        port        = "443"
        status_code = "HTTP_301"
      }
    }

    target_group_arn = local.has_cert ? null : aws_lb_target_group.this.arn
  }
}

output "alb_arn" {
  value = aws_lb.this.arn
}

output "alb_dns_name" {
  value = aws_lb.this.dns_name
}

output "target_group_arn" {
  value = aws_lb_target_group.this.arn
}

output "alb_security_group_id" {
  value = aws_security_group.alb.id
}
