<div align="center">

# ATLAS BANK

<p align="center">
  <strong>Comprehensive Banking Management System</strong>
</p>

<sub> Created by: </sub>
<p align="center">
  <a href="https://github.com/emilymontec">Emily Monterrosa</a>
</p>

<img src="https://img.shields.io/badge/backend-springboot-0f766e?style=flat-square">
<img src="https://img.shields.io/badge/frontend-html5/css3/javascript-0f766e?style=flat-square">
<img src="https://img.shields.io/badge/database-postgresql-0f766e?style=flat-square">

</div>

---

Im a student focused on exploring emerging technologies and developing innovative solutions.

As part of my learning and experimentation process, I created a system that enables the management of accounts, transfers, deposits, withdrawals, and cards, ensuring balance consistency through transactional logic.

| | |
|---|---|
| **Account Management** | opening bank accounts, real-time balance inquiries, customer information management, linking bank cards. |
| **Financial Transactions** | deposits, withdrawals, inter-account transfers, transaction history, transaction log. |
| **Anti-Fraud System** | detection of location changes, identification of unusual amounts, generation of risk alerts, continuous monitoring without blocking legitimate transactions. |
| **Financial Simulation Engine** | loan simulation, credit forecasting, interest calculation, controlled financial scenarios, analysis of future account performance. |

You can do all of this here.

---

## Technologies Used

<img src="https://img.shields.io/badge/Springboot-3.3.5-0f766e?style=flat-square"> <img src="https://img.shields.io/badge/HTML-5-0f766e?style=flat-square"> <img src="https://img.shields.io/badge/CSS-3-0f766e?style=flat-square"> <img src="https://img.shields.io/badge/JavaScript-Vanilla-0f766e?style=flat-square"> <img src="https://img.shields.io/badge/Supabase-PostgreSQL-0f766e?style=flat-square">

---

## System Architecture
```
atlas-bank → Web Client → Frontend → REST API → Database
```

---

## Installation

```bash
git clone https://github.com/emilymontec/atlas-bank.git; cd atlas-bank
```

Clone the repository on your computer and navigate to the project directory.

### Set environment variables

Create a `.env` file in the root directory of the project and add the following variables:

```bash
# .env
DB_URL=jdbc:postgresql://<host>:<port>/<database>
DB_USERNAME=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_secret_key_min_32_chars
SERVER_PORT=8080
```

### Configure the database

```sql
CREATE DATABASE ATLASBANK;
```

Then apply the schema migrations found in `src/main/resources/`.

### Execute

```bash
./mvnw spring-boot:run
```
or
```bash
mvn spring-boot:run
```

> The app will be available at: http://localhost:8080

---

## File Structure
```bash
ATLASBANK/
│
├── .mvn/
├── atlasbank_front/          ← standalone UI prototype (not served by Spring Boot)
│    ├── inicio.html
│    ├── login.html
│    ├── dashboard.html
│    ├── cuentas.html
│    ├── transferencias.html
│    ├── movivmientos.html
│    ├── tarjetas.html
│    ├── usuarios.html
│    ├── panel_admin.html
│    ├── 404.html
│    ├── exito.html
│    └── fallo.html
├── src/
│    ├── main/
│    │     ├── java/com/bank/atlasbank/
│    │     │                    ├── account/
│    │     │                    ├── admin/
│    │     │                    ├── common/
│    │     │                    ├── customer/
│    │     │                    ├── savings/
│    │     │                    ├── security/
│    │     │                    ├── transaction/
│    │     │                    ├── AtlasBankApplication.java
│    │     │                    ├── DataInitializer.java
│    │     │                    └── WebConfig.java
│    │     └── resources/
│    │             ├── static/
│    │                    ├── admin/
│    │                    ├── app/
│    │                    ├── assets/
│    │                    ├── auth/
│    │                    ├── common/
│    │                    ├── customer/
│    │                    ├── inicio.html
│    │                    ├── application-postgres.properties
│    │                    └── application.properties
│    └── test/
│
├── .gitignore
├── atlasbank.mv.db
├── atlassbank.trace.db
├── mvnw
├── mvnw.cmd
├── pom.xml
├── LICENSE
└── README.md
```

---

## API Overview

| Domain | Endpoint prefix | Description |
|---|---|---|
| Auth | `/api/auth` | Register, login (returns JWT) |
| Accounts | `/api/accounts` | Open account, balance inquiry, account list |
| Transactions | `/api/transactions` | Deposits, withdrawals, transfers, history |
| Cards | `/api/cards` | Issue card, link to account, card status |
| Savings | `/api/savings` | Savings goals, savings accounts |
| Simulation | `/api/simulation` | Loan simulation, interest calculation, credit forecast |

> Full endpoint reference: see Javadoc on controller classes under `src/main/java/com/bank/atlasbank/`.

---

## License

This project is licensed under the **[MIT License](./LICENSE)**. See the file for more information.
