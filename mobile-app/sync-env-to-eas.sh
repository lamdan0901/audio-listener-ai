#!/bin/bash

# Path to your .env file
ENV_FILE=".env"

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

  echo "Creating secret: $key"
  eas secret:create --name "$key" --value "$value" --non-interactive

done < "$ENV_FILE"

echo "✅ Done syncing .env to EAS secrets."
