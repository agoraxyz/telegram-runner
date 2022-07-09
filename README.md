<p align="center">
	<img src="docs/img/guild_bot.png" width="200px" />
</p>

Guild bot is part of the [Guild project](https://docs.guild.xyz/guild).
The purpose of this bot is to provide security for guilds by managing users.

- [Website](https://guild.xyz)
- [Changelog](./CHANGELOG.md)
- [License](./LICENSE)

## Getting started

Install dependencies:

```bash
npm install
# or
yarn install
```

Create a new file called _.env_ and add the following environment variables:

```bash
BACKEND_URL=https://api.agora.space
BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
BOT_USERNAME=example_username_bot
REDIS_HOST=redis://@redis:6379
ADMIN_VIDEO_URL=https://example.com/test.mp4
GROUPID_IMAGE=https://example.com/test.png
```

Create another file called _redis.env_:

```bash
ALLOW_EMPTY_PASSWORD=no
REDIS_DISABLE_COMMANDS=FLUSHDB,FLUSHALL
REDIS_PASSWORD=
REDIS_PORT_NUMBER=6381
```

Running the bot:

```bash
# for development:
npm run dev
# or
yarn dev

# for production:
npm run build && npm run prod
# or
yarn build && yarn prod

# inside a Docker container
docker-compose up --build
```

## Documentation

For the full, comprehensive documentation on how to add Medousa to your group
and how to customize her to suit your needs read the markdown documents in the
[docs](./docs) folder.

## Contributing

Thank you for your interest in contributing! Please refer to
[CONTRIBUTING.md](./docs/CONTRIBUTING.md) for guidance.
