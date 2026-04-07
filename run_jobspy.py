#!/usr/bin/env python3
import argparse
import json
import sys
import pandas as pd
from jobspy import scrape_jobs, Site

def parse_sites(sites_str):
    site_map = {
        'google': Site.GOOGLE,
        'indeed': Site.INDEED,
        'glassdoor': Site.GLASSDOOR,
        'linkedin': Site.LINKEDIN,
        'ziprecruiter': Site.ZIP_RECRUITER
    }
    
    sites = []
    for s in sites_str.split(','):
        s = s.strip().lower()
        if s in site_map:
            sites.append(site_map[s])
        else:
            print(f"Warning: Unknown site '{s}', skipping", file=sys.stderr)
    
    return sites

def location_to_str(location):
    if pd.isna(location) or not location:
        return None
    return str(location)

def job_type_to_str(job_type):
    if pd.isna(job_type) or not job_type:
        return None
    return str(job_type)

def compensation_to_json(comp):
    if pd.isna(comp) or not comp:
        return None
    return str(comp)

def main():
    parser = argparse.ArgumentParser(description='JobSpy scraper')
    parser.add_argument('--sites', required=True, help='Comma-separated sites: google,indeed,glassdoor')
    parser.add_argument('--keyword', required=True, help='Search keyword')
    parser.add_argument('--location', default='', help='Location')
    parser.add_argument('--results', type=int, default=15, help='Number of results per site')
    parser.add_argument('--remote', action='store_true', help='Remote only')
    parser.add_argument('--hours-old', type=int, help='Filter by hours old')
    
    args = parser.parse_args()
    
    sites = parse_sites(args.sites)
    if not sites:
        print("Error: No valid sites specified", file=sys.stderr)
        sys.exit(1)
    
    try:
        # Set UTF-8 encoding for stdout
        sys.stdout.reconfigure(encoding='utf-8')
        
        df = scrape_jobs(
            site_name=sites,
            search_term=args.keyword,
            location=args.location,
            results_wanted=args.results,
            is_remote=args.remote,
            hours_old=args.hours_old
        )
        
        if df is None or df.empty:
            print("[]")
            return
        
        results = []
        for _, job in df.iterrows():
            source = job.get('site', 'jobspy')
            if pd.isna(source):
                source = 'jobspy'
            
            result = {
                'title': job.get('title', '') or '',
                'company': job.get('company_name', '') or 'N/A',
                'location': location_to_str(job.get('location')),
                'link': job.get('job_url', '') or '',
                'description': job.get('description', '') or '',
                'job_id': job.get('id', None),
                'source': source,
                'job_type': job_type_to_str(job.get('job_type')),
                'is_remote': 1 if job.get('is_remote') else 0,
                'date_posted': str(job.get('date_posted'))[:10] if not pd.isna(job.get('date_posted')) else None,
                'compensation': compensation_to_json(job.get('compensation')),
                'emails': json.dumps(job.get('emails')) if not pd.isna(job.get('emails')) else None
            }
            results.append(result)
        
        print(json.dumps(results, ensure_ascii=False), file=sys.stdout, flush=True)
        
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()