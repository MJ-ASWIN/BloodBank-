"""
Community Blood & Platelet Emergency Network
Backend: Flask + MySQL (via SQLAlchemy)

Run locally:
    pip install -r requirements.txt
    # Configure your MySQL credentials in the DB_URL below (or as env vars)
    python app.py

The app will auto-create tables on first run.
"""

import os
from datetime import datetime

from flask import Flask, jsonify, request, render_template
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import or_

# --------------------------------------------------------------------------
# CONFIG
# --------------------------------------------------------------------------
app = Flask(__name__)

DB_USER = os.environ.get("DB_USER", "root")
DB_PASS = os.environ.get("DB_PASS", "password")
DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_PORT = os.environ.get("DB_PORT", "3306")
DB_NAME = os.environ.get("DB_NAME", "blood_network")

# MySQL connection string (uses PyMySQL driver).
MYSQL_URL = f"mysql+pymysql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# Fallback to SQLite automatically for local testing (USE_SQLITE=1, the
# default when you just run `python app.py` on your own machine).
#
# IMPORTANT — on Vercel: the filesystem is read-only/ephemeral, so SQLite
# does NOT persist there. Set USE_SQLITE=0 in your Vercel project's
# environment variables and point DB_USER/DB_PASS/DB_HOST/DB_NAME at a real,
# externally-hosted MySQL instance (e.g. Aiven, Railway, Clever Cloud).
USE_SQLITE_FALLBACK = os.environ.get("USE_SQLITE", "1") == "1"

if USE_SQLITE_FALLBACK:
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:////tmp/blood_network.db"
else:
    app.config["SQLALCHEMY_DATABASE_URI"] = MYSQL_URL

app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
URGENCY_LEVELS = ["Critical", "Urgent", "Normal"]


# --------------------------------------------------------------------------
# MODELS
# --------------------------------------------------------------------------
class Donor(db.Model):
    __tablename__ = "donors"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    blood_group = db.Column(db.String(5), nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    email = db.Column(db.String(120))
    city = db.Column(db.String(100), nullable=False)
    can_donate_platelets = db.Column(db.Boolean, default=False)
    last_donated = db.Column(db.String(20))  # simple date string, optional
    is_available = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "blood_group": self.blood_group,
            "phone": self.phone,
            "email": self.email,
            "city": self.city,
            "can_donate_platelets": self.can_donate_platelets,
            "last_donated": self.last_donated,
            "is_available": self.is_available,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M"),
        }


class EmergencyRequest(db.Model):
    __tablename__ = "requests"

    id = db.Column(db.Integer, primary_key=True)
    patient_name = db.Column(db.String(120), nullable=False)
    blood_group = db.Column(db.String(5), nullable=False)
    component = db.Column(db.String(20), default="Whole Blood")  # Whole Blood / Platelets
    units_needed = db.Column(db.Integer, default=1)
    hospital = db.Column(db.String(150), nullable=False)
    city = db.Column(db.String(100), nullable=False)
    contact_name = db.Column(db.String(120), nullable=False)
    contact_phone = db.Column(db.String(20), nullable=False)
    urgency = db.Column(db.String(20), default="Normal")
    notes = db.Column(db.String(300))
    status = db.Column(db.String(20), default="Active")  # Active / Fulfilled
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "patient_name": self.patient_name,
            "blood_group": self.blood_group,
            "component": self.component,
            "units_needed": self.units_needed,
            "hospital": self.hospital,
            "city": self.city,
            "contact_name": self.contact_name,
            "contact_phone": self.contact_phone,
            "urgency": self.urgency,
            "notes": self.notes,
            "status": self.status,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M"),
        }


with app.app_context():
    db.create_all()


# --------------------------------------------------------------------------
# PAGE ROUTE
# --------------------------------------------------------------------------
@app.route("/")
def index():
    return render_template("index.html", blood_groups=BLOOD_GROUPS, urgency_levels=URGENCY_LEVELS)


# --------------------------------------------------------------------------
# API: DONORS
# --------------------------------------------------------------------------
@app.route("/api/donors", methods=["POST"])
def create_donor():
    data = request.get_json(force=True)

    required = ["name", "blood_group", "phone", "city"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    if data["blood_group"] not in BLOOD_GROUPS:
        return jsonify({"error": "Invalid blood group"}), 400

    donor = Donor(
        name=data["name"].strip(),
        blood_group=data["blood_group"],
        phone=data["phone"].strip(),
        email=(data.get("email") or "").strip() or None,
        city=data["city"].strip(),
        can_donate_platelets=bool(data.get("can_donate_platelets", False)),
        last_donated=(data.get("last_donated") or "").strip() or None,
        is_available=True,
    )
    db.session.add(donor)
    db.session.commit()
    return jsonify({"message": "Donor registered successfully", "donor": donor.to_dict()}), 201


@app.route("/api/donors", methods=["GET"])
def list_donors():
    blood_group = request.args.get("blood_group", "").strip()
    city = request.args.get("city", "").strip()
    platelets_only = request.args.get("platelets_only", "").lower() == "true"

    query = Donor.query.filter(Donor.is_available == True)  # noqa: E712

    if blood_group:
        query = query.filter(Donor.blood_group == blood_group)
    if city:
        query = query.filter(Donor.city.ilike(f"%{city}%"))
    if platelets_only:
        query = query.filter(Donor.can_donate_platelets == True)  # noqa: E712

    donors = query.order_by(Donor.created_at.desc()).all()
    return jsonify([d.to_dict() for d in donors])


@app.route("/api/donors/<int:donor_id>/toggle", methods=["PATCH"])
def toggle_donor_availability(donor_id):
    donor = Donor.query.get_or_404(donor_id)
    donor.is_available = not donor.is_available
    db.session.commit()
    return jsonify(donor.to_dict())


# --------------------------------------------------------------------------
# API: EMERGENCY REQUESTS
# --------------------------------------------------------------------------
@app.route("/api/requests", methods=["POST"])
def create_request():
    data = request.get_json(force=True)

    required = ["patient_name", "blood_group", "hospital", "city", "contact_name", "contact_phone"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    if data["blood_group"] not in BLOOD_GROUPS:
        return jsonify({"error": "Invalid blood group"}), 400

    urgency = data.get("urgency", "Normal")
    if urgency not in URGENCY_LEVELS:
        urgency = "Normal"

    req = EmergencyRequest(
        patient_name=data["patient_name"].strip(),
        blood_group=data["blood_group"],
        component=data.get("component", "Whole Blood"),
        units_needed=int(data.get("units_needed", 1) or 1),
        hospital=data["hospital"].strip(),
        city=data["city"].strip(),
        contact_name=data["contact_name"].strip(),
        contact_phone=data["contact_phone"].strip(),
        urgency=urgency,
        notes=(data.get("notes") or "").strip() or None,
        status="Active",
    )
    db.session.add(req)
    db.session.commit()
    return jsonify({"message": "Emergency request posted", "request": req.to_dict()}), 201


@app.route("/api/requests", methods=["GET"])
def list_requests():
    status = request.args.get("status", "Active")
    blood_group = request.args.get("blood_group", "").strip()
    city = request.args.get("city", "").strip()

    query = EmergencyRequest.query
    if status in ("Active", "Fulfilled"):
        query = query.filter(EmergencyRequest.status == status)
    if blood_group:
        query = query.filter(EmergencyRequest.blood_group == blood_group)
    if city:
        query = query.filter(EmergencyRequest.city.ilike(f"%{city}%"))

    # Critical first, then Urgent, then Normal; newest first within each.
    urgency_order = db.case(
        (EmergencyRequest.urgency == "Critical", 0),
        (EmergencyRequest.urgency == "Urgent", 1),
        else_=2,
    )
    reqs = query.order_by(urgency_order, EmergencyRequest.created_at.desc()).all()
    return jsonify([r.to_dict() for r in reqs])


@app.route("/api/requests/<int:request_id>/fulfill", methods=["PATCH"])
def fulfill_request(request_id):
    req = EmergencyRequest.query.get_or_404(request_id)
    req.status = "Fulfilled"
    db.session.commit()
    return jsonify(req.to_dict())


# --------------------------------------------------------------------------
# API: STATS (for homepage dashboard)
# --------------------------------------------------------------------------
@app.route("/api/stats")
def stats():
    total_donors = Donor.query.filter_by(is_available=True).count()
    active_requests = EmergencyRequest.query.filter_by(status="Active").count()
    critical_requests = EmergencyRequest.query.filter_by(status="Active", urgency="Critical").count()
    cities = db.session.query(Donor.city).distinct().count()
    return jsonify(
        {
            "total_donors": total_donors,
            "active_requests": active_requests,
            "critical_requests": critical_requests,
            "cities_covered": cities,
        }
    )


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)