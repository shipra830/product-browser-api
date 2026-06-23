# Product Browser API

A backend application built with Node.js, Express.js, and PostgreSQL to efficiently browse 200,000 products with category filtering and cursor-based pagination.

## Features

* Browse 200,000 products
* Category filtering
* Cursor-based pagination
* Consistent results during product updates
* PostgreSQL indexing for fast queries
* Batch database seeding
* Simple frontend UI

## Tech Stack

* Node.js
* Express.js
* PostgreSQL (Neon)
* Render

## API Endpoint

GET /api/products

Query Parameters:

* category
* limit
* cursor

Example:

/api/products?limit=20

## Pagination Strategy

Cursor-based pagination using:

* updated_at DESC
* id DESC

This avoids duplicate or missing products when data changes while users are browsing.

## Database Indexes

* (updated_at DESC, id DESC)
* (category, updated_at DESC, id DESC)

## Seeding

The database is populated with 200,000 products using batch inserts for better performance.

Run:

npm run seed

## Run Locally

npm install

Create .env file:

DATABASE_URL=your_database_url

Start server:

npm start

## Improvements

With more time I would add:

* Search functionality
* Automated testing
* API documentation
* Caching
* Monitoring
