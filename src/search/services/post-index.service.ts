import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { ConfigService } from '@nestjs/config';
import type { estypes } from '@elastic/elasticsearch';

interface PostDocument {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorNickname: string;
  tags: string[];
  likeCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class PostIndexService implements OnModuleInit {
  private readonly logger = new Logger(PostIndexService.name);
  private readonly indexName: string;

  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    private readonly configService: ConfigService,
  ) {
    this.indexName =
      this.configService.get<string>('elasticsearch.indices.posts') || 'posts';
  }

  async onModuleInit(): Promise<void> {
    await this.createIndexIfNotExists();
  }

  private async createIndexIfNotExists(): Promise<void> {
    try {
      const indexExists = await this.elasticsearchService.indices.exists({
        index: this.indexName,
      });

      if (!indexExists) {
        await this.createIndex();
        this.logger.log(`Index "${this.indexName}" created successfully`);
      } else {
        this.logger.log(`Index "${this.indexName}" already exists`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to check/create index: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async createIndex(): Promise<void> {
    const mappingProperties: Record<string, estypes.MappingProperty> = {
      id: { type: 'keyword' },
      title: {
        type: 'text',
        analyzer: 'korean_analyzer',
        fields: {
          keyword: { type: 'keyword' },
        },
      },
      content: {
        type: 'text',
        analyzer: 'korean_analyzer',
      },
      authorId: { type: 'keyword' },
      authorNickname: {
        type: 'text',
        fields: {
          keyword: { type: 'keyword' },
        },
      },
      tags: { type: 'keyword' },
      likeCount: { type: 'integer' },
      commentCount: { type: 'integer' },
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
    };

    const createRequest: estypes.IndicesCreateRequest = {
      index: this.indexName,
      settings: {
        number_of_shards: 1,
        number_of_replicas: 0,
        analysis: {
          analyzer: {
            korean_analyzer: {
              type: 'custom',
              tokenizer: 'standard',
              filter: ['lowercase', 'trim'],
            },
          },
        },
      },
      mappings: {
        properties: mappingProperties,
      },
    };

    await this.elasticsearchService.indices.create(createRequest);
  }

  async indexPost(post: PostDocument): Promise<void> {
    try {
      await this.elasticsearchService.index({
        index: this.indexName,
        id: post.id,
        document: post,
        refresh: true,
      });
      this.logger.debug(`Post indexed: ${post.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to index post: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  async updatePost(
    post: Partial<PostDocument> & { id: string },
  ): Promise<void> {
    try {
      await this.elasticsearchService.update({
        index: this.indexName,
        id: post.id,
        doc: post,
        refresh: true,
      });
      this.logger.debug(`Post updated: ${post.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to update post: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  async deletePost(postId: string): Promise<void> {
    try {
      await this.elasticsearchService.delete({
        index: this.indexName,
        id: postId,
        refresh: true,
      });
      this.logger.debug(`Post deleted: ${postId}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete post: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  async bulkIndex(posts: PostDocument[]): Promise<void> {
    if (posts.length === 0) return;

    const operations = posts.flatMap((post) => [
      { index: { _index: this.indexName, _id: post.id } },
      post,
    ]);

    try {
      const response = await this.elasticsearchService.bulk({
        operations,
        refresh: true,
      });

      if (response.errors) {
        const erroredDocuments: string[] = [];
        response.items.forEach((action, i) => {
          const operation = Object.keys(action)[0] as keyof typeof action;
          const item = action[operation];
          if (item && 'error' in item && item.error) {
            erroredDocuments.push(posts[i].id);
          }
        });
        this.logger.error(
          `Failed to bulk index some posts: ${erroredDocuments.join(', ')}`,
        );
      } else {
        this.logger.log(`Bulk indexed ${posts.length} posts`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to bulk index posts: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  async reindexAll(posts: PostDocument[]): Promise<void> {
    this.logger.log(`Reindexing ${posts.length} posts...`);

    // Delete existing index
    try {
      await this.elasticsearchService.indices.delete({ index: this.indexName });
    } catch {
      // Index might not exist
    }

    // Recreate index
    await this.createIndex();

    // Bulk index all posts
    const batchSize = 100;
    for (let i = 0; i < posts.length; i += batchSize) {
      const batch = posts.slice(i, i + batchSize);
      await this.bulkIndex(batch);
    }

    this.logger.log('Reindexing completed');
  }
}
