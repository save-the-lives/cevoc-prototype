terraform {
  required_version = ">= 1.5.0" # OpenTofu >= 1.6.0 is also fine

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state — uncomment and configure for team use
  # backend "s3" {
  #   bucket         = "cevoc-tfstate"
  #   key            = "aws/terraform.tfstate"
  #   region         = "ap-southeast-2"
  #   dynamodb_table = "cevoc-tflock"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "cevoc"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
