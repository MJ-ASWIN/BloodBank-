# LifeLine — Community Blood & Platelet Emergency Network

A full-stack emergency blood/platelet request-and-donor network.

**Stack:** HTML, CSS, JavaScript (vanilla) &middot; Python Flask &middot; MySQL (via SQLAlchemy + PyMySQL)

## What it does

- **Emergency requests** — anyone can post a request (patient, blood group, units, hospital, urgency) that appears instantly on a live board.
- **Donor registration** — donors register once with blood group + city and become instantly searchable.
- **Find donors** — search/filter the donor pool by blood group, city, and platelet-donation willingness.
- **Active board** — every open request, critical cases sorted first, with a "mark fulfilled" action.
- **Live stats + ticker** — homepage shows real-time counts and a scrolling strip of critical requests.

## Project structure

```
blood_network/
├── app.py                 # Flask app: routes, models, API
├── schema.sql              # Reference MySQL schema (SQLAlchemy also auto-creates it)
├── requirements.txt
├── templates/
│   └── index.html          # Single-page app shell
└── static/
    ├── css/style.css
    └── js/app.js
```

## Running it

### 1. Install dependencies
```bash
cd blood_network
pip install -r requirements.txt
```

### 2. Quick start (no MySQL needed)
By default the app runs on **SQLite** so you can try it instantly:
```bash
python app.py
```
Then open **http://localhost:5000**

### 3. Switch to MySQL (production)
1. Create the database:
   ```bash
   mysql -u root -p < schema.sql
   ```
2. Set your credentials as environment variables and disable the SQLite fallback:
   ```bash
   export DB_USER=root
   export DB_PASS=yourpassword
   export DB_HOST=localhost
   export DB_NAME=blood_network
   export USE_SQLITE=0
   python app.py
   ```
The exact same code and API run against either database — only the connection string changes.

## API reference

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/donors` | Register a donor |
| `GET`  | `/api/donors?blood_group=&city=&platelets_only=` | Search donors |
| `PATCH`| `/api/donors/<id>/toggle` | Toggle a donor's availability |
| `POST` | `/api/requests` | Post an emergency request |
| `GET`  | `/api/requests?status=&blood_group=&city=` | List requests (critical sorted first) |
| `PATCH`| `/api/requests/<id>/fulfill` | Mark a request fulfilled |
| `GET`  | `/api/stats` | Homepage dashboard counts |

## Notes for extending it

- **Auth**: there's currently no login — donor/requester identity is just what they type in. Add Flask-Login + a `users` table if you need accounts.
- **Notifications**: to auto-alert matching donors when a critical request is posted, add an SMS/WhatsApp webhook (e.g. Twilio) inside `create_request()` in `app.py`.
- **Geolocation**: city is a plain text match today (`ILIKE`); swap in lat/lng + a distance query if you want "nearest donor" instead of "same city."
