describe('URL Encoding', () => {
  test('encodes keyword with spaces correctly', () => {
    const keyword = 'software engineer';
    const encoded = encodeURIComponent(keyword);
    expect(encoded).toBe('software%20engineer');
  });

  test('encodes location with spaces correctly', () => {
    const location = 'São Paulo';
    const encoded = encodeURIComponent(location);
    expect(encoded).toBe('S%C3%A3o%20Paulo');
  });

  test('encodes special characters correctly', () => {
    const keyword = 'react/node.js developer';
    const encoded = encodeURIComponent(keyword);
    expect(encoded).toBe('react%2Fnode.js%20developer');
  });

  test('encodes ampersand in search terms', () => {
    const keyword = 'R&D Developer';
    const encoded = encodeURIComponent(keyword);
    expect(encoded).toBe('R%26D%20Developer');
  });

  test('generates valid LinkedIn search URL', () => {
    const keyword = 'software engineer';
    const location = 'Brazil';
    const encodedKeyword = encodeURIComponent(keyword);
    const encodedLocation = encodeURIComponent(location);
    
    const searchUrl = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodedKeyword}&location=${encodedLocation}`;
    
    expect(searchUrl).toBe('https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=software%20engineer&location=Brazil');
  });
});
