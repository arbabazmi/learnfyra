#!/usr/bin/env bash
# Creates all Learnfyra DynamoDB tables with the -local suffix.
# Usage: bash scripts/create-local-tables.sh
# To delete all: bash scripts/create-local-tables.sh --delete

set -euo pipefail

ENV="local"
REGION="${AWS_REGION:-us-east-1}"

# Simple tables (pk only, no GSI)
declare -A SIMPLE_TABLES=(
  [LearnfyraAggregates]="id"
  [LearnfyraRewardProfiles]="id"
  [LearnfyraGenerationLog]="worksheetId"
  [LearnfyraModelConfig]="id"
  [LearnfyraModelAuditLog]="id"
  [LearnfyraQuestionExposureHistory]="id"
  [LearnfyraConfig]="configKey"
  [LearnfyraPasswordResets]="tokenId"
  [LearnfyraParentLinks]="id"
  [LearnfyraAdminPolicies]="id"
  [LearnfyraAdminAuditEvents]="id"
  [LearnfyraAdminIdempotency]="id"
  [LearnfyraRepeatCapOverrides]="id"
  [LearnfyraQuestionBank]="questionId"
)

if [[ "${1:-}" == "--delete" ]]; then
  echo "Deleting all Learnfyra-${ENV} tables..."
  for table in "${!SIMPLE_TABLES[@]}"; do
    echo "  Deleting ${table}-${ENV}..."
    aws dynamodb delete-table --table-name "${table}-${ENV}" --region "$REGION" 2>/dev/null || true
  done
  for table in LearnfyraUsers LearnfyraAttempts LearnfyraCertificates LearnfyraClasses LearnfyraMemberships; do
    echo "  Deleting ${table}-${ENV}..."
    aws dynamodb delete-table --table-name "${table}-${ENV}" --region "$REGION" 2>/dev/null || true
  done
  echo "Done."
  exit 0
fi

echo "Creating Learnfyra DynamoDB tables with -${ENV} suffix in ${REGION}..."

# ── Simple tables (PK only, no GSI) ──────────────────────────────────────────
for table in "${!SIMPLE_TABLES[@]}"; do
  pk="${SIMPLE_TABLES[$table]}"
  TABLE_NAME="${table}-${ENV}"
  echo "Creating ${TABLE_NAME} (pk=${pk})..."
  aws dynamodb create-table \
    --table-name "$TABLE_NAME" \
    --attribute-definitions "AttributeName=${pk},AttributeType=S" \
    --key-schema "AttributeName=${pk},KeyType=HASH" \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION" \
    --no-cli-pager 2>/dev/null && echo "  OK" || echo "  Already exists or error"
done

# ── UsersTable (GSI: email-index) ────────────────────────────────────────────
echo "Creating LearnfyraUsers-${ENV} (pk=userId, GSI: email-index)..."
aws dynamodb create-table \
  --table-name "LearnfyraUsers-${ENV}" \
  --attribute-definitions \
    "AttributeName=userId,AttributeType=S" \
    "AttributeName=email,AttributeType=S" \
  --key-schema "AttributeName=userId,KeyType=HASH" \
  --global-secondary-indexes '[{
    "IndexName": "email-index",
    "KeySchema": [{"AttributeName": "email", "KeyType": "HASH"}],
    "Projection": {"ProjectionType": "ALL"}
  }]' \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION" \
  --no-cli-pager 2>/dev/null && echo "  OK" || echo "  Already exists or error"

# ── AttemptsTable (GSI: studentId-index) ─────────────────────────────────────
echo "Creating LearnfyraAttempts-${ENV} (pk=attemptId, GSI: studentId-index)..."
aws dynamodb create-table \
  --table-name "LearnfyraAttempts-${ENV}" \
  --attribute-definitions \
    "AttributeName=attemptId,AttributeType=S" \
    "AttributeName=studentId,AttributeType=S" \
  --key-schema "AttributeName=attemptId,KeyType=HASH" \
  --global-secondary-indexes '[{
    "IndexName": "studentId-index",
    "KeySchema": [{"AttributeName": "studentId", "KeyType": "HASH"}],
    "Projection": {"ProjectionType": "ALL"}
  }]' \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION" \
  --no-cli-pager 2>/dev/null && echo "  OK" || echo "  Already exists or error"

# ── CertificatesTable (GSI: studentId-index) ────────────────────────────────
echo "Creating LearnfyraCertificates-${ENV} (pk=id, GSI: studentId-index)..."
aws dynamodb create-table \
  --table-name "LearnfyraCertificates-${ENV}" \
  --attribute-definitions \
    "AttributeName=id,AttributeType=S" \
    "AttributeName=studentId,AttributeType=S" \
  --key-schema "AttributeName=id,KeyType=HASH" \
  --global-secondary-indexes '[{
    "IndexName": "studentId-index",
    "KeySchema": [{"AttributeName": "studentId", "KeyType": "HASH"}],
    "Projection": {"ProjectionType": "ALL"}
  }]' \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION" \
  --no-cli-pager 2>/dev/null && echo "  OK" || echo "  Already exists or error"

# ── ClassesTable (GSI: inviteCode-index KEYS_ONLY) ──────────────────────────
echo "Creating LearnfyraClasses-${ENV} (pk=classId, GSI: inviteCode-index)..."
aws dynamodb create-table \
  --table-name "LearnfyraClasses-${ENV}" \
  --attribute-definitions \
    "AttributeName=classId,AttributeType=S" \
    "AttributeName=inviteCode,AttributeType=S" \
  --key-schema "AttributeName=classId,KeyType=HASH" \
  --global-secondary-indexes '[{
    "IndexName": "inviteCode-index",
    "KeySchema": [{"AttributeName": "inviteCode", "KeyType": "HASH"}],
    "Projection": {"ProjectionType": "KEYS_ONLY"}
  }]' \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION" \
  --no-cli-pager 2>/dev/null && echo "  OK" || echo "  Already exists or error"

# ── MembershipsTable (GSI: studentId-index, classId-index) ──────────────────
echo "Creating LearnfyraMemberships-${ENV} (pk=id, GSIs: studentId-index, classId-index)..."
aws dynamodb create-table \
  --table-name "LearnfyraMemberships-${ENV}" \
  --attribute-definitions \
    "AttributeName=id,AttributeType=S" \
    "AttributeName=studentId,AttributeType=S" \
    "AttributeName=classId,AttributeType=S" \
  --key-schema "AttributeName=id,KeyType=HASH" \
  --global-secondary-indexes '[
    {
      "IndexName": "studentId-index",
      "KeySchema": [{"AttributeName": "studentId", "KeyType": "HASH"}],
      "Projection": {"ProjectionType": "ALL"}
    },
    {
      "IndexName": "classId-index",
      "KeySchema": [{"AttributeName": "classId", "KeyType": "HASH"}],
      "Projection": {"ProjectionType": "ALL"}
    }
  ]' \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION" \
  --no-cli-pager 2>/dev/null && echo "  OK" || echo "  Already exists or error"

# ── Enable TTL on applicable tables ─────────────────────────────────────────
echo "Enabling TTL on PasswordResets and AdminIdempotency..."
aws dynamodb update-time-to-live \
  --table-name "LearnfyraPasswordResets-${ENV}" \
  --time-to-live-specification "Enabled=true,AttributeName=expiresAt" \
  --region "$REGION" \
  --no-cli-pager 2>/dev/null || true

aws dynamodb update-time-to-live \
  --table-name "LearnfyraAdminIdempotency-${ENV}" \
  --time-to-live-specification "Enabled=true,AttributeName=expiresAt" \
  --region "$REGION" \
  --no-cli-pager 2>/dev/null || true

echo ""
echo "All tables created. Verifying..."
aws dynamodb list-tables --region "$REGION" --query "TableNames[?contains(@, '-${ENV}')]" --output table
