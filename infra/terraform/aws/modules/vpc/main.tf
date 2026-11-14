# CEVOC — VPC with public and private subnets
# Public subnets: ALB. Private subnets: ECS Fargate tasks.
# NAT: single gateway for dev, HA pair for prod.

variable "environment" { type = string }
variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

locals {
  is_prod = var.environment == "prod"
  name    = "cevoc-${var.environment}"
  azs     = slice(data.aws_availability_zones.available.names, 0, 2)
}

data "aws_availability_zones" "available" {
  state = "available"
}

# ---------- VPC ----------
resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = "${local.name}-vpc" }
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = "${local.name}-igw" }
}

# ---------- Public subnets ----------
resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.this.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone       = local.azs[count.index]
  map_public_ip_on_launch = true
  tags                    = { Name = "${local.name}-public-${count.index == 0 ? "a" : "b"}" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = "${local.name}-public-rt" }
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.this.id
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ---------- NAT Gateway ----------
resource "aws_eip" "nat" {
  count  = local.is_prod ? 2 : 1
  domain = "vpc"
  tags   = { Name = "${local.name}-nat-eip-${count.index}" }
}

resource "aws_nat_gateway" "this" {
  count         = local.is_prod ? 2 : 1
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id
  tags          = { Name = "${local.name}-nat-${count.index == 0 ? "a" : "b"}" }
  depends_on    = [aws_internet_gateway.this]
}

# ---------- Private subnets ----------
resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.this.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 2)
  availability_zone = local.azs[count.index]
  tags              = { Name = "${local.name}-private-${count.index == 0 ? "a" : "b"}" }
}

resource "aws_route_table" "private" {
  count  = 2
  vpc_id = aws_vpc.this.id
  tags   = { Name = "${local.name}-private-rt-${count.index == 0 ? "a" : "b"}" }
}

resource "aws_route" "private_nat" {
  count                  = 2
  route_table_id         = aws_route_table.private[count.index].id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = local.is_prod ? aws_nat_gateway.this[count.index].id : aws_nat_gateway.this[0].id
}

resource "aws_route_table_association" "private" {
  count          = 2
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# ---------- Outputs ----------
output "vpc_id" {
  value = aws_vpc.this.id
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}
