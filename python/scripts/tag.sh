while IFS= read -r package; do
  name=$(echo "$package" | cut -d ' ' -f 1)
  version=$(echo "$package" | cut -d ' ' -f 2)
  
  if [ "$name" = "create-onchain-agent" ]; then
    tag_name="create-onchain-agent-python"
    message="Release create-onchain-agent python version $version"
  else
    tag_name="$name"
    message="Release $name version $version"
  fi

  echo "git tag -a \"$tag_name@$version\" -m \"$message\""
  git tag -a "$tag_name@$version" -m "$message"

  echo "git push origin \"$tag_name@$version\""
  git push origin "$tag_name@$version"
done < .to-publish-pypi
