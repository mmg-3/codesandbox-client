import getTemplate from '@codesandbox/common/lib/templates';
import { Sandbox } from '@codesandbox/common/lib/types';
import axios from 'axios';

const GHPagesBaseUrl = 'https://builder.csbops.io/gh-pages';

type Options = {
  provideJwtToken: () => Promise<string | null>;
};

export default (() => {
  let _options: Options;
  let _jwtToken: string | undefined;
  const createHeaders = (jwt: string) =>
    jwt
      ? {
          Authorization: `Bearer ${jwt}`,
        }
      : {};

  return {
    initialize(options: Options) {
      _options = options;
    },
    async provideJwtCached() {
      if (!_jwtToken) {
        try {
          const token = await _options.provideJwtToken();
          setTimeout(() => {
            // Token expires after 10 seconds, for safety we actually cache the token
            // for 5 seconds
            _jwtToken = undefined;
          }, 5000);
          return token;
        } catch (e) {
          _jwtToken = undefined;
          return Promise.reject(e);
        }
      }

      return _jwtToken;
    },

    async getSite(id: string) {
      const url = `${GHPagesBaseUrl}/${id}`;
      const token = await this.provideJwtCached();

      const { data } = await axios.get(url, {
        headers: createHeaders(token),
      });
      return data;
    },

    async getLogs(id: string) {
      const url = `${GHPagesBaseUrl}/${id}/status`;
      const token = await this.provideJwtCached();

      const { data } = await axios.get(url, {
        headers: createHeaders(token),
      });

      return data;
    },

    async deploy(sandbox: Sandbox, username: string): Promise<any> {
      const token = await this.provideJwtCached();
      const template = getTemplate(sandbox.template);
      const buildCommand = (name: string) => {
        if (name === 'styleguidist') {
          return 'styleguide:build';
        }
        if (name === 'nuxt') {
          return 'generate';
        }

        if (name === 'parcel') {
          return `build --public-url /csb-${sandbox.id}/`;
        }

        if (name === 'preact-cli') {
          return 'build --no-prerender';
        }

        if (name === 'gatsby') {
          return 'build --prefix-paths';
        }

        return 'build';
      };

      const env = (name: string) => {
        if (name === 'create-react-app') {
          return `PUBLIC_URL=https://${username}.github.io/csb-${sandbox.id}/`;
        }
        return '';
      };

      const website = await axios.post(
        `${GHPagesBaseUrl}/${sandbox.id}`,
        {
          dist: template.distDir,
          env: env(template.name),
          buildCommand: buildCommand(template.name),
        },
        { headers: createHeaders(token) }
      );

      return website;
    },
  };
})();
