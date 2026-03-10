const axios = require('axios');

function getSearchQueryByIssueType(issueType) {
  switch (issueType?.toLowerCase()) {
    case 'wage': case 'salary':
        return 'Labour Commissioner Office';
    case 'consumer': case 'product': case 'fraud':
        return 'Consumer Forum';
    case 'cyber': case 'online': case 'hacking':
        return 'Cyber Crime Cell Police';
    case 'domestic': case 'violence': case 'abuse':
        return 'One Stop Centre Women Helpline';
    case 'property': case 'rent': case 'landlord':
        return 'Civil Court';
    case 'rti':
        return 'District Collectorate';
    default:
        return 'District Legal Services Authority';
  }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(1);
}

async function findNearestOfficeAndLawyers(lat, lng, issueType) {
    const searchQuery = getSearchQueryByIssueType(issueType);
    const radius = 1.0; // 1 degree ≈ 111 km — wide enough to find results

    // No bounded=1 — let Nominatim search the full viewbox area without hard boundary
    const officeUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=5&countrycodes=in&viewbox=${lng - radius},${lat + radius},${lng + radius},${lat - radius}`;
    const lawyerUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent('lawyer advocate')}&format=json&limit=10&countrycodes=in&viewbox=${lng - radius},${lat + radius},${lng + radius},${lat - radius}`;

    console.log(`--> Location: Searching for "${searchQuery}" around lat:${lat}, lng:${lng}`);

    try {
        const [officeRes, lawyerRes] = await Promise.all([
            axios.get(officeUrl, { headers: { 'User-Agent': 'NyayAI/1.0 (contact@nyay.ai)' }, timeout: 8000 }),
            axios.get(lawyerUrl, { headers: { 'User-Agent': 'NyayAI/1.0 (contact@nyay.ai)' }, timeout: 8000 })
        ]);

        const addDistance = (items) => items.map(o => ({
            ...o,
            distance: calculateDistance(parseFloat(lat), parseFloat(lng), parseFloat(o.lat), parseFloat(o.lon))
        })).sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));

        let nearestOffice = null;
        if (officeRes.data?.length > 0) {
            nearestOffice = addDistance(officeRes.data)[0];
            console.log(`--> Location: Found office: ${nearestOffice.display_name} (${nearestOffice.distance} km)`);
        } else {
            console.warn('--> Location: No offices found for query:', searchQuery);
        }

        let topLawyers = [];
        if (lawyerRes.data?.length > 0) {
            topLawyers = addDistance(lawyerRes.data).slice(0, 3);
            console.log(`--> Location: Found ${topLawyers.length} nearby lawyers.`);
        }

        return { office: nearestOffice, lawyers: topLawyers };

    } catch (err) {
        console.error('--> Location: Nominatim error:', err.message);
        return { office: null, lawyers: [] };
    }
}

module.exports = { findNearestOfficeAndLawyers };
