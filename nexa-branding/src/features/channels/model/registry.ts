import rawChannels from '../data/channels.json';
import rawNetworks from '@/features/network/data/networks.json';
import type { Channel } from './types';
export const channels: Channel[] = rawChannels;
export const networks = rawNetworks;
export const getChannel = (id: string) => channels.find((channel) => channel.id === id);
export const getNetworkChannels = (networkId: string) =>
  channels.filter((channel) => channel.networkId === networkId);
