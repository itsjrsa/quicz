---
icon: lucide/download
---

# Install

## Requirements

- Node.js 20+
- npm 9+
- (Optional) Docker + Docker Compose for containerised deployment

## Docker

```bash
cp .env.example .env
# Edit .env with your values
docker compose up -d
```

The app will be available at <http://localhost:3000>.

## Local development

1. Clone the repository:

    ```bash
    git clone https://github.com/itsjrsa/quicz.git
    cd quicz
    ```

2. Install dependencies:

    ```bash
    npm install
    ```

3. Copy the environment file and set your values:

    ```bash
    cp .env.example .env
    ```

4. (Optional) Run migrations — they run automatically on server start:

    ```bash
    npm run db:migrate
    ```

5. Start the development server:

    ```bash
    npm run dev
    ```

    Open <http://localhost:3000>.
