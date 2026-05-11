export interface IronClawWorkerConfig {
  doApiToken: string;
  doRegion: string;
  doSize: string;
  workerDid: string;
  workerNearAccount: string;
  storachaPrivateKey: string;
  storachaDelegation: string;
  storachaSpaceDid: string;
  coordinatorDid: string;
  ensueApiKey: string;
  ensueCoordinatorOrg: string;
  nearAiApiKey: string;
  webhookSecret: string;
  webhookPort: number;
  coordinatorContract: string;
}

export interface DeployedIronClawWorker {
  dropletId: number;
  dropletIp: string;
  webhookUrl: string;
  webhookSecret: string;
  cvmId: string;
  workerDid: string;
}

export interface DropletApiResponse {
  id: number;
  status: 'new' | 'active' | 'off' | 'archive';
  networks: {
    v4: Array<{ ip_address: string; type: 'public' | 'private' }>;
  };
}

export interface IronClawJobStatus {
  job_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'stuck';
  response?: string;
  created_at: string;
  completed_at?: string;
  error?: string;
}

export type IronClawDeployStep =
  | 'creating_droplet'
  | 'waiting_for_ip'
  | 'waiting_for_ssh'
  | 'waiting_for_cloud_init'
  | 'configuring_agent'
  | 'starting_agent'
  | 'waiting_for_webhook'
  | 'complete';
