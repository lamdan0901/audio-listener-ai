#!/bin/bash

# Path to your .env file
ENV_FILE=".env.production"

# Get environment from argument, default to production
EAS_ENVIRONMENT=${1:-production}

# Check if the file exists
if [ ! -f "$ENV_FILE" ]; then
  echo "$ENV_FILE does not exist."
  exit 1
fi

echo "Reading variables from $ENV_FILE and creating EAS secrets..."

# Read the file line by line
while IFS='=' read -r key value
do
  # Skip empty lines and comments
  if [[ -z "$key" || "$key" =~ ^# ]]; then
    continue
  fi

  # Trim whitespace and remove quotes if present
  key=$(echo "$key" | xargs)
  value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")

  # Skip if key is empty after trimming
  if [ -z "$key" ]; then
    echo "Skipping empty key."
    continue
  fi

  echo "Creating secret: $key"
  eas env:create --name "$key" --value "$value" --non-interactive --scope project --visibility sensitive --environment $EAS_ENVIRONMENT  --force

done < "$ENV_FILE"

echo "✅ Done syncing .env to EAS secrets."
