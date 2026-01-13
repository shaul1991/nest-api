import { registerAs } from '@nestjs/config';

export default registerAs('elasticsearch', () => ({
  node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
  maxRetries: parseInt(process.env.ELASTICSEARCH_MAX_RETRIES ?? '3', 10),
  requestTimeout: parseInt(
    process.env.ELASTICSEARCH_REQUEST_TIMEOUT ?? '30000',
    10,
  ),
  pingTimeout: parseInt(process.env.ELASTICSEARCH_PING_TIMEOUT ?? '3000', 10),
  indices: {
    posts: process.env.ELASTICSEARCH_INDEX_POSTS || 'posts',
    comments: process.env.ELASTICSEARCH_INDEX_COMMENTS || 'comments',
    users: process.env.ELASTICSEARCH_INDEX_USERS || 'users',
  },
}));
