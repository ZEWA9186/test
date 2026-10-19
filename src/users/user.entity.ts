import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  username: string;
  //TODO Исправить под прод
  @Column({ nullable: true })
  password: string;

  @Column()
  role: string; // например: 'admin', 'user', 'guest'

  @Column({ name: 'is_active', nullable: true })
  isActive: boolean;
}
