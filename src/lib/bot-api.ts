import axios from 'axios';

const botApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BOT_API_URL ?? 'https://bot.aeronexus.app',
  headers: { 'x-bot-secret': process.env.NEXT_PUBLIC_BOT_API_SECRET ?? '' },
  timeout: 10_000,
});

export default botApi;
