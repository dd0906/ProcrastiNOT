# ProcrastiNOT

A local-first academic planning app that helps students recover their study schedule when unexpected commitments disrupt their day.

## Features

- Create and manage study tasks.
- Add fixed commitments and protected sleep time.
- Generate a recovery proposal when an unexpected commitment is added.
- Compare the original schedule with proposed changes.
- Approve a recovery proposal or keep the original schedule.
- See task-level explanations and scheduling risks.
- Save planner data in browser local storage.
- Preserve previous-day plans through date rollover.

## Requirements

- Node.js and npm
- Git (optional, for cloning the repository)

## Run locally

Clone the repository, then enter its directory:

```bash
git clone https://github.com/dd0906/ProcrastiNOT.git
cd ProcrastiNOT
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local URL printed in the terminal.

## Run tests

```bash
npm test -- --run
```

## Build for production

```bash
npm run build
```

## Data and privacy

Planner data is stored in browser local storage. This version does not require an application backend or user account. Data saved in one browser is not automatically synchronized to another device.

## Project documentation

- `devpost/scope.md` — approved project scope
- `devpost/prd.md` — product requirements
- `devpost/spec.md` — technical specification
- `devpost/checklist.md` — build and review checkpoints
- `devpost/app-map.html` — code tour and app map

## License

This project is licensed under the MIT License. See `LICENSE`.


