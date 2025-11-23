// src/auth/github-oauth.ts

export interface GitHubOAuthConfig {
  clientId: string;
  scopes: string[];
}

export interface DeviceCodeResponse {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

export interface TokenResponse {
  accessToken: string;
  scopes: string[];
}

export class GitHubOAuth {
  private readonly clientId: string;
  private readonly scopes: string[];

  constructor(config: GitHubOAuthConfig) {
    this.clientId = config.clientId;
    this.scopes = config.scopes;
  }

  /**
   * Request device code from GitHub
   */
  async requestDeviceCode(): Promise<DeviceCodeResponse> {
    const params = new URLSearchParams({
      client_id: this.clientId,
      scope: this.scopes.join(' '),
    });

    const response = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Failed to request device code: ${response.statusText}`);
    }

    const data = await response.json() as any;

    return {
      deviceCode: data.device_code,
      userCode: data.user_code,
      verificationUri: data.verification_uri,
      expiresIn: data.expires_in,
      interval: data.interval,
    };
  }

  /**
   * Poll GitHub for authorization
   */
  async pollForToken(
    deviceCode: string,
    intervalSeconds: number,
    maxAttempts: number = 100
  ): Promise<TokenResponse> {
    let attempts = 0;
    let currentInterval = intervalSeconds;

    while (attempts < maxAttempts) {
      attempts++;

      await this.sleep(currentInterval * 1000);

      const params = new URLSearchParams({
        client_id: this.clientId,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      });

      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        throw new Error(`OAuth polling failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;

      // Check for errors
      if (data.error) {
        switch (data.error) {
          case 'authorization_pending':
            // Still waiting for user
            continue;

          case 'slow_down':
            // Increase polling interval
            currentInterval += 5;
            continue;

          case 'expired_token':
            throw new Error('Device code expired. Please try again.');

          case 'access_denied':
            throw new Error('Authorization denied by user.');

          default:
            throw new Error(`OAuth error: ${data.error}`);
        }
      }

      // Success!
      return {
        accessToken: data.access_token,
        scopes: data.scope?.split(' ').filter((s: string) => s.length > 0) || [],
      };
    }

    throw new Error('Polling timeout: User did not authorize in time.');
  }

  /**
   * Full authentication flow
   */
  async authenticate(): Promise<TokenResponse> {
    // Step 1: Request device code
    const deviceCode = await this.requestDeviceCode();

    // Step 2: Display instructions to user
    console.log('\n🔐 GitHub Authentication Required\n');
    console.log(`Please visit: ${deviceCode.verificationUri}`);
    console.log(`And enter code: ${deviceCode.userCode}\n`);
    console.log('Waiting for authorization...');

    // Step 3: Poll for token
    const token = await this.pollForToken(
      deviceCode.deviceCode,
      deviceCode.interval
    );

    console.log('✅ Authentication successful!\n');

    return token;
  }

  /**
   * Sleep helper
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
