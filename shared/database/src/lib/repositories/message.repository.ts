import { Repository } from 'typeorm';
import { AppDataSource } from '../database';
import { Message } from '../entities/message';

export class MessageRepository {
  private repository: Repository<Message>;

  constructor() {
    this.repository = AppDataSource.getRepository(Message);
  }

  async findAll(): Promise<Message[]> {
    return await this.repository.find({
      order: { createdAt: 'DESC' }
    });
  }

  async findById(id: string): Promise<Message | null> {
    return await this.repository.findOne({ where: { id } });
  }

  async create(content: string): Promise<Message> {
    const message = this.repository.create({ content });
    return await this.repository.save(message);
  }

  async update(id: string, content: string): Promise<Message | null> {
    await this.repository.update(id, { content });
    return await this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return result.affected !== null && result.affected > 0;
  }

  async getHelloWorldMessage(): Promise<Message | null> {
    return await this.repository.findOne({
      where: { content: 'Hello World from PostgreSQL!' }
    });
  }
}