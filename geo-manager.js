import ngeohash from 'https://esm.sh/ngeohash';

export class GeoManager {
    constructor() {
        this.currentLat = null;
        this.currentLng = null;
        this.precision = 12; // High precision for exact pinning
    }

    async getPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error("Geolocation is not supported by this browser."));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.currentLat = position.coords.latitude;
                    this.currentLng = position.coords.longitude;
                    resolve({ lat: this.currentLat, lng: this.currentLng });
                },
                (error) => {
                    reject(error);
                }
            );
        });
    }

    getGeohash(precision = this.precision) {
        if (this.currentLat === null || this.currentLng === null) {
            throw new Error("Location not set");
        }
        return ngeohash.encode(this.currentLat, this.currentLng, precision);
    }

    encode(lat, lng, precision = this.precision) {
        return ngeohash.encode(lat, lng, precision);
    }

    decode(hash) {
        return ngeohash.decode(hash);
    }

    // Get neighbors for broader discovery
    // Supports passing a specific geohash, or defaults to current location
    getNeighborGeohashes(geohash) {
        const centerHash = geohash || this.getGeohash();
        const neighbors = ngeohash.neighbors(centerHash);
        return [centerHash, ...neighbors];
    }
}
