# Company GitHub Setup

This guide takes the existing source code from a local folder to a controlled private repository in the company GitHub organization.

## 1. What every developer needs

Install these before cloning or running the application:

| Requirement | Purpose | Check |
|---|---|---|
| Company GitHub organization access | Read/write access to the private repository | You can open the organization in a browser |
| Git for Windows | Version control and pushing branches | `git --version` |
| Node.js 24 LTS | Runs Next.js, NestJS, Prisma, tests, and builds | `node --version` |
| npm 11 or compatible npm 10+ | Installs monorepo dependencies | `npm --version` |
| Docker Desktop | Runs PostgreSQL locally and optionally the full stack | `docker version` |
| Docker Compose v2 | Starts local services | `docker compose version` |
| A modern Chromium browser | Camera/microphone testing | Chrome or Edge current version |
| VS Code or another IDE | Recommended development environment | Optional |
| GitHub CLI | Easier authentication and PR work | Optional: `gh --version` |

On Windows, Docker Desktop should use the WSL 2 backend. Enable virtualization in the BIOS if Docker reports that virtualization is unavailable.

## 2. Request company access

Ask the company GitHub administrator for:

- membership in the correct GitHub organization;
- permission to create a private repository, or a repository created for you;
- `Write` access for developers;
- `Maintain` or `Admin` access for the technical owner;
- the company team that should own reviews and production settings;
- confirmation of whether SSH, HTTPS, SSO authorization, signed commits, IP allowlists, or a VPN are required.

Do not paste personal access tokens into chat, source files, `.env`, or Git remote URLs.

## 3. Create the company repository

Recommended repository name:

```text
internal-video-interview-platform
```

Create it under the company organization with these settings:

- Visibility: **Private**
- Initialize with README: **No**
- Add `.gitignore`: **No**
- Add license: **No**, unless the company has selected an internal license
- Default branch: `main`
- Issues: enabled if the team will use GitHub Issues
- Wiki: optional; prefer versioned documentation under `docs/`
- Discussions: disabled unless the company actively uses it

The repository must be empty because this project already includes its README, ignore rules, CI workflow, and documentation.

## 4. Configure Git identity and authentication

Set the company identity used on commits:

```bash
git config --global user.name "Your Name"
git config --global user.email "your.name@company.com"
```

Recommended HTTPS authentication:

```bash
gh auth login
```

Select GitHub.com, HTTPS, browser authentication, and authorize access to the company organization if prompted.

If the company requires SSH, add a company-approved SSH key to GitHub and test it:

```bash
ssh -T git@github.com
```

Use either HTTPS or SSH consistently. Do not embed a token in the remote URL.

## 5. First push from the delivered project folder

Open PowerShell, Git Bash, or the VS Code terminal in the extracted `internal-video-interview-platform` folder.

First confirm that secrets and generated files are not staged:

```bash
git init -b main
git status
git check-ignore .env var/uploads
```

Both `.env` and files under `var/uploads` must be ignored. Then create the initial commit:

```bash
git add .
git status
git commit -m "chore: scaffold internal video interview platform"
```

Add the company repository remote. Replace the example organization with the real one:

```bash
git remote add origin https://github.com/COMPANY-ORG/internal-video-interview-platform.git
git remote -v
git push -u origin main
```

SSH alternative:

```bash
git remote add origin git@github.com:COMPANY-ORG/internal-video-interview-platform.git
git push -u origin main
```

After pushing, open the Actions tab and confirm the `CI` workflow succeeds.

## 6. Configure repository ownership and protection

For a small development team, use a GitHub ruleset for `main` with:

- block force pushes and branch deletion;
- require changes through a pull request;
- require one approval;
- dismiss stale approvals after new commits;
- require all review conversations to be resolved;
- require the `verify` CI check;
- require the branch to be up to date before merge;
- allow squash merge;
- automatically delete merged branches;
- restrict ruleset bypass to a named technical owner or company administrator.

Add real owners only after the organization team name is known. A typical active `.github/CODEOWNERS` file would be:

```text
* @COMPANY-ORG/interview-platform-team
/packages/database/ @COMPANY-ORG/interview-platform-team
/.github/ @COMPANY-ORG/platform-or-devops-team
```

Do not commit placeholder owners: GitHub silently ignores invalid users or teams.

## 7. Enable repository security controls

Enable the controls available to the company plan:

- Dependabot alerts and security updates;
- secret scanning and push protection;
- dependency graph;
- code scanning/CodeQL;
- private vulnerability reporting;
- branch protection/rulesets;
- restricted GitHub Actions permissions (`read` by default);
- approval for workflows from forks, if forks are allowed.

CI currently needs no production secret. The PostgreSQL service used in CI is temporary and uses development-only credentials.

## 8. Local setup after cloning

Clone and enter the repository:

```bash
git clone https://github.com/COMPANY-ORG/internal-video-interview-platform.git
cd internal-video-interview-platform
```

Create local configuration:

```bash
copy .env.example .env
```

In Git Bash, macOS, or Linux use:

```bash
cp .env.example .env
```

Start PostgreSQL, install dependencies, create the schema, and seed demo data:

```bash
docker compose up -d postgres
npm ci
npm run db:generate
npx prisma migrate dev --schema packages/database/prisma/schema.prisma --name init
npm run db:seed
npm run dev
```

Open:

- hiring portal: `http://localhost:3000`
- candidate demo: `http://localhost:3000/interview/demo-candidate-token`
- API documentation: `http://localhost:4000/api/docs`

For a fully containerized local run:

```bash
docker compose up --build
```

The standard developer setup is preferable while coding because Next.js and NestJS hot reload faster outside the application containers.

## 9. Daily development workflow

Never develop directly on `main`:

```bash
git switch main
git pull --ff-only
git switch -c feature/question-image-upload
```

Before opening a pull request:

```bash
npm test
npm run build
git status
git add <changed-paths>
git commit -m "feat: support uploaded question images"
git push -u origin feature/question-image-upload
```

Open a PR, obtain review, wait for CI, and squash merge.

## 10. GitHub environments and secrets for later deployment

Create `staging` and `production` GitHub Environments only when deployment work starts. Typical environment secrets or OIDC-provided values will include:

- database connection;
- object-storage bucket and region;
- OIDC/SSO client ID and secret;
- email provider credentials;
- transcription provider credentials;
- application signing secrets;
- monitoring/error-tracking connection details.

Prefer GitHub OIDC and a cloud secret manager over long-lived cloud access keys. Require manual approval for production deployments. Never expose server secrets with a `NEXT_PUBLIC_` prefix.

## 11. First repository acceptance checklist

- [ ] Private repository created under the company organization
- [ ] Project pushed to `main`
- [ ] CI passes in GitHub Actions
- [ ] At least two company users can clone the repository
- [ ] Branch ruleset is active
- [ ] One real CODEOWNERS team is configured
- [ ] Secret scanning and Dependabot are enabled
- [ ] Each developer can start PostgreSQL and run the app locally
- [ ] Camera/microphone recording works on `localhost`
- [ ] `npm test` and `npm run build` pass locally
- [ ] No `.env`, video, resume, or candidate data exists in Git history
