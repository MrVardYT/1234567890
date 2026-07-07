// Source - https://stackoverflow.com/a/79282587
// Posted by Mama africa, modified by community. See post 'Timeline' for change history
// Retrieved 2026-07-07, License - CC BY-SA 4.0

import requests
import schedule
import time
import logging

def ping_endpoints():
    endpoints = [
        "https://heal-uk5d.onrender.com"  # Replace with your actual URLs
    ]
    
    for url in endpoints:
        try:
            response = requests.get(url, timeout=10)
            logging.info(f"Pinged {url}. Status code: {response.status_code}")
        except Exception as e:
            logging.error(f"Error pinging {url}: {e}")

def main():
    logging.basicConfig(level=logging.INFO)
    ping_endpoints()

if __name__ == "__main__":
    main()
