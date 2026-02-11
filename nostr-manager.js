import { SimplePool, generateSecretKey, getPublicKey, finalizeEvent, nip19 } from 'https://esm.sh/nostr-tools@2.1.0';
import { bytesToHex, hexToBytes } from 'https://esm.sh/@noble/hashes@1.3.3/utils';

export class NostrManager {
    constructor(defaultRelays) {
        this.pool = new SimplePool();
        // Load relays from storage or default
        const savedRelays = localStorage.getItem('nostr_relays');
        this.relays = savedRelays ? JSON.parse(savedRelays) : (defaultRelays || [
            'wss://relay.damus.io',
            'wss://nos.lol',
            'wss://relay.nostr.band',
            'wss://relay.primal.net'
        ]);

        this.sk = null; // Private Key (Uint8Array)
        this.pk = null; // Public Key (Hex)
        this.profile = null; // User Metadata
    }

    // --- Auth & Keys ---

    async loadSession() {
        const savedSk = localStorage.getItem('nostr_sk');
        if (savedSk) {
            try {
                this.sk = hexToBytes(savedSk);
                this.pk = getPublicKey(this.sk);
                await this.fetchUserProfile();
                return this.pk;
            } catch (e) {
                console.error("Invalid saved key", e);
                localStorage.removeItem('nostr_sk');
            }
        }
        return null;
    }

    async createAccount() {
        this.sk = generateSecretKey();
        this.pk = getPublicKey(this.sk);
        localStorage.setItem('nostr_sk', bytesToHex(this.sk));
        return this.pk;
    }

    async loginWithSecret(keyString) {
        try {
            if (keyString.startsWith('nsec')) {
                const { data } = nip19.decode(keyString);
                this.sk = data;
            } else {
                this.sk = hexToBytes(keyString);
            }
            this.pk = getPublicKey(this.sk);
            localStorage.setItem('nostr_sk', bytesToHex(this.sk));
            await this.fetchUserProfile();
            return this.pk;
        } catch (e) {
            throw new Error("Invalid Key: " + e.message);
        }
    }

    logout() {
        this.sk = null;
        this.pk = null;
        this.profile = null;
        localStorage.removeItem('nostr_sk');
        localStorage.removeItem('nostr_relays');
    }

    getNpub() {
        if (!this.pk) return null;
        return nip19.npubEncode(this.pk);
    }

    getNsec() {
        if (!this.sk) return null;
        return nip19.nsecEncode(this.sk);
    }

    // --- Relays ---

    getRelays() {
        return this.relays;
    }

    addRelay(url) {
        if (!url.startsWith('wss://')) throw new Error("URL must start with wss://");
        if (!this.relays.includes(url)) {
            this.relays.push(url);
            this.saveRelays();
        }
    }

    removeRelay(url) {
        this.relays = this.relays.filter(r => r !== url);
        this.saveRelays();
    }

    saveRelays() {
        localStorage.setItem('nostr_relays', JSON.stringify(this.relays));
    }

    // --- Profile ---

    async fetchUserProfile() {
        if (!this.pk) return;
        try {
            const event = await this.pool.get(this.relays, {
                kinds: [0],
                authors: [this.pk]
            });
            if (event) {
                this.profile = JSON.parse(event.content);
            }
        } catch (e) {
            console.warn("Retrying profile fetch", e);
        }
    }

    async publishCheckIn(geohash, topicMap, startTimeUnix, endTimeUnix, details) {
        // details: { name, place, note }

        // Geohashing for Discovery
        // We publish both the precise location (12 chars) and a broader 'sector' (5 chars)
        // so that users searching the general area can find it.
        const discoveryGeohash = geohash.substring(0, 5);

        const tags = [
            ['g', geohash],            // Precision 12: For exact pin
            ['g', discoveryGeohash],   // Precision 5: For discovery/subscriptions
            ['expiration', endTimeUnix.toString()],
            ['t', 'nostrmeet'],
            ['start_time', startTimeUnix.toString()],
            ['end_time', endTimeUnix.toString()],
            ['d', `checkin:${this.pk}`]
        ];

        // Topics
        for (const [topic, status] of topicMap.entries()) {
            tags.push(['t', topic]);
            tags.push(['topic_status', `${topic}:${status}`]);
        }

        // New V3 Fields in Content
        const contentObj = {
            name: details.name,
            place: details.place,
            note: details.note,
            topics: Object.fromEntries(topicMap)
        };

        const contentText = `📍 Check-in at ${details.place || geohash}\n` +
            `👤 ${details.name}\n` +
            (details.note ? `📝 ${details.note}\n` : '') +
            `\nTopics:\n` +
            Array.from(topicMap.entries()).map(([t, s]) => `- ${t} ${s === 'talk' ? '🗣️' : '👂'}`).join('\n') +
            `\n\n(JSON: ${JSON.stringify(contentObj)})`; // Fallback for clients that read text

        const eventTemplate = {
            kind: 1,
            created_at: Math.floor(Date.now() / 1000),
            tags: tags,
            content: contentText
        };

        let event;
        if (this.sk) {
            event = finalizeEvent(eventTemplate, this.sk);
        } else {
            throw new Error("Not logged in");
        }

        await Promise.any(this.pool.publish(this.relays, event));
        return event;
    }

    subscribeToNearby(geohashes, callback) {
        const filter = {
            kinds: [1],
            '#g': geohashes,
            since: Math.floor(Date.now() / 1000) - (12 * 3600),
            '#t': ['nostrmeet']
        };

        this.pool.subscribeMany(
            this.relays,
            [filter],
            {
                onevent(event) {
                    callback(event);
                }
            }
        );
    }
}
