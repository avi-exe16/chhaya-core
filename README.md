# Chhaya-core

A civic incident reporting and prioritization platform. Citizens send hazard reports (photos, audio notes, GPS location) through WhatsApp, and the system merges duplicate reports into single incidents, ranks them by priority, and generates contractor work orders.

**Status:** in development, currently running locally. Setup instructions and a live demo will be added.

## Features

- Receives citizen reports (photos, audio notes, GPS location) through WhatsApp webhooks
- Detects duplicate reports by comparing photos with perceptual hashing (pHash, distance <= 10) and clustering nearby locations with DBSCAN
- Ranks incidents with a priority score
- Uses an LLM to generate contractor work orders (scope of work) for each incident
- Operations dashboard with a complaints feed, a Leaflet map view, and a media inspection viewer

##
