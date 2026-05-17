# BookMyMeal Backend

This is the Django backend for the BookMyMeal project.

## Setup and Running

1. **Environment:**
   ```bash
   venv\Scripts\activate
   ```

2. **Database Migrations:**
   ```bash
   python manage.py migrate
   ```

3. **Seeding Demo Data:**
   We have a custom seed command to populate the database with demo users, menu items, and orders.
   ```bash
   python manage.py seed          # load demo data
   python manage.py seed --flush  # wipe and reload fresh
   ```

4. **Run Server:**
   ```bash
   python manage.py runserver
   ```

## Demo Credentials

All accounts use the password: `Demo@1234`

| Username | Role |
|---|---|
| `padma_superuser` | Superuser |
| `manager_arun` | Manager |
| `caterer_vandana` | Caterer |
| `caretaker_ramesh` | Caretaker |
| `guest_aditi` | Guest |
