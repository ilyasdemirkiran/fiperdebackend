#!/usr/bin/env bash
set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}   Fiperde Backend Pre-push Check        ${NC}"
echo -e "${BLUE}==========================================${NC}\n"

# 1. Typecheck
echo -e "${YELLOW}Step 1/2: Checking TypeScript types (tsc)...${NC}"
if bun x tsc --noEmit; then
  echo -e "${GREEN}✓ Typecheck passed with 0 errors.${NC}\n"
else
  echo -e "${RED}✗ Typecheck failed. Please fix TypeScript errors before pushing.${NC}"
  exit 1
fi

# 2. Run Test Suite
echo -e "${YELLOW}Step 2/2: Running complete test suite (bun test)...${NC}"
if bun test; then
  echo -e "${GREEN}✓ All unit and integration tests passed.${NC}\n"
else
  echo -e "${RED}✗ Tests failed. Please resolve failing tests before pushing.${NC}"
  exit 1
fi

echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}   All checks passed! Ready to push.     ${NC}"
echo -e "${GREEN}==========================================${NC}"
