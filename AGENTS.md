Use jj version control for this project.

Prefer the following flow: Treat the working copy as a scratch space, make changes there and then use `jj commit` to save changes into a new change, describing it then.

When using `jj commit`, only include the relevant files (other files may have been changed by a separate conversation, don't include those).

When rebasing across workspaces, never use another workspace's working directory as the base, always use the most recently committed jj change instead.
