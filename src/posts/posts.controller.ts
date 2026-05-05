import { Controller, Get, Post, Body, UseGuards, Request, HttpException, HttpStatus, Delete, Patch, Param } from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  async create(@Request() req, @Body() createPostDto: CreatePostDto) {
    // 📝 LOG DIAGNÓSTICO EN ARCHIVO
    try {
      const fs = require('fs');
      const logPath = 'c:/Users/Usuario/.antigravity/APPS/autopostlab-api/scratch/last_request.json';
      const logData = {
        timestamp: new Date().toISOString(),
        user: req.user,
        body: createPostDto
      };
      fs.writeFileSync(logPath, JSON.stringify(logData, null, 2));
    } catch (e) {}

    try {
      const workspaceId = req.user?.workspaceId; 
      const organizationId = req.organizationId;
      if (!workspaceId) {
        throw new Error("⚠️ Sesión expirada o token antiguo. Por favor, cierra sesión (cierra y abre la app) e inicia con Google de nuevo.");
      }
      console.log("Intentando crear post en Workspace ID:", workspaceId);
      return await this.postsService.create(workspaceId, organizationId, createPostDto);
    } catch (e) {
      console.error("Error backend en POST /posts:", e);
      throw new HttpException(e.message || e.toString(), HttpStatus.BAD_REQUEST);
    }
  }

  @Get()
  findAll(@Request() req) {
    const workspaceId = req.user.workspaceId;
    const organizationId = req.organizationId;
    return this.postsService.findAllByWorkspace(workspaceId, organizationId);
  }

  @Delete(':id')
  async remove(@Request() req, @Param('id') id: string) {
     const workspaceId = req.user.workspaceId;
     const organizationId = req.organizationId;
     return this.postsService.remove(id, workspaceId, organizationId);
  }

  @Patch(':id')
  async update(@Request() req, @Param('id') id: string, @Body('content') content: string) {
     const workspaceId = req.user.workspaceId;
     const organizationId = req.organizationId;
     return this.postsService.updatePostContent(id, workspaceId, organizationId, content);
  }

  @Patch('scheduled/:id')
  async updateScheduled(@Request() req, @Param('id') id: string, @Body('scheduledAt') scheduledAt: string) {
     const workspaceId = req.user.workspaceId;
     const organizationId = req.organizationId;
     return this.postsService.updateScheduledDate(id, workspaceId, organizationId, scheduledAt);
  }

  @Post('scheduled/:id/publish')
  async publishScheduled(@Request() req, @Param('id') id: string) {
     try {
       const workspaceId = req.user.workspaceId;
       const organizationId = req.organizationId;
       return await this.postsService.publishScheduledPostNow(id, workspaceId, organizationId);
     } catch (e: any) {
       console.error("Error en publishScheduled:", e);
       throw new HttpException(e.message || e.toString(), HttpStatus.BAD_REQUEST);
     }
  }
}
