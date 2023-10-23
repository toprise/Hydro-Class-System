/* eslint-disable global-require */
import {
  ContestModel, Context, Handler, ObjectId, param, PERM, PRIV, ProblemModel, Schema,
  SettingModel, SystemModel, SystemSettings, Types, UserModel,
} from 'hydrooj';
import convert from 'schemastery-jsonschema';
import markdown from './backendlib/markdown';

class WikiHelpHandler extends Handler {
  noCheckPermView = true;

  async get() {
    const LANGS = SettingModel.langs;
    const languages = {};
    for (const key in LANGS) {
      if (LANGS[key].hidden) continue;
      languages[`${LANGS[key].display}(${key})`] = LANGS[key].compile || LANGS[key].execute;
    }
    this.response.body = { languages };
    this.response.template = 'wiki_help.html';
  }
}

class WikiAboutHandler extends Handler {
  noCheckPermView = true;

  async get() {
    let raw = SystemModel.get('ui-default.about') || '';
    // TODO template engine
    raw = raw.replace(/{{ name }}/g, this.domain.ui?.name || SystemModel.get('server.name')).trim();
    const lines = raw.split('\n');
    const sections = [];
    for (const line of lines) {
      if (line.startsWith('# ')) {
        const id = line.split(' ')[1];
        sections.push({
          id,
          title: line.split(id)[1].trim(),
          content: '',
        });
      } else sections[sections.length - 1].content += `${line}\n`;
    }
    this.response.template = 'about.html';
    this.response.body = { sections };
  }
}

class SetThemeHandler extends Handler {
  noCheckPermView = true;

  async get({ theme }) {
    this.checkPriv(PRIV.PRIV_USER_PROFILE);
    await UserModel.setById(this.user._id, { theme });
    this.back();
  }
}

class LegacyModeHandler extends Handler {
  noCheckPermView = true;

  @param('legacy', Types.Boolean)
  @param('nohint', Types.Boolean)
  async get(domainId: string, legacy = false, nohint = false) {
    this.session.legacy = legacy;
    this.session.nohint = nohint;
    this.back();
  }
}

class MarkdownHandler extends Handler {
  noCheckPermView = true;

  async post({ text, inline = false }) {
    this.response.body = inline
      ? markdown.renderInline(text)
      : markdown.render(text);
    this.response.type = 'text/html';
    this.response.status = 200;
  }
}

class SystemConfigSchemaHandler extends Handler {
  async get() {
    const schema = convert(Schema.intersect(SystemSettings) as any, true);
    this.response.body = schema;
  }
}

class RichMediaHandler extends Handler {
  async renderUser(domainId, payload) {
    let d = payload.domainId || domainId;
    const cur = payload.domainId ? await UserModel.getById(payload.domainId, this.user._id) : this.user;
    if (!cur.hasPerm(PERM.PERM_VIEW)) d = domainId;
    const udoc = Number.isNaN(+payload.id) ? await UserModel.getByUname(d, payload.id) : await UserModel.getById(d, +payload.id);
    return await this.renderHTML('partials/user.html', { udoc });
  }

  async renderProblem(domainId, payload) {
    const cur = payload.domainId ? await UserModel.getById(payload.domainId, this.user._id) : this.user;
    let pdoc = cur.hasPerm(PERM.PERM_VIEW | PERM.PERM_VIEW_PROBLEM)
      ? await ProblemModel.get(payload.domainId || domainId, payload.id) || ProblemModel.default
      : ProblemModel.default;
    if (pdoc.hidden && !cur.own(pdoc) && !cur.hasPerm(PERM.PERM_VIEW_PROBLEM_HIDDEN)) pdoc = ProblemModel.default;
    return await this.renderHTML('partials/problem.html', { pdoc });
  }

  async renderContest(domainId, payload) {
    const cur = payload.domainId ? await UserModel.getById(payload.domainId, this.user._id) : this.user;
    const tdoc = cur.hasPerm(PERM.PERM_VIEW | PERM.PERM_VIEW_CONTEST)
      ? await ContestModel.get(payload.domainId || domainId, new ObjectId(payload.id))
      : null;
    if (tdoc) return await this.renderHTML('partials/contest.html', { tdoc });
    return '';
  }

  async renderHomework(domainId, payload) {
    const cur = payload.domainId ? await UserModel.getById(payload.domainId, this.user._id) : this.user;
    const tdoc = cur.hasPerm(PERM.PERM_VIEW | PERM.PERM_VIEW_HOMEWORK)
      ? await ContestModel.get(payload.domainId || domainId, new ObjectId(payload.id))
      : null;
    if (tdoc) return await this.renderHTML('partials/homework.html', { tdoc });
    return '';
  }

  async post({ domainId, items }) {
    const res = [];
    for (const item of items || []) {
      if (item.domainId && item.domainId === domainId) delete item.domainId;
      if (item.type === 'user') res.push(this.renderUser(domainId, item).catch(() => ''));
      else if (item.type === 'problem') res.push(this.renderProblem(domainId, item).catch(() => ''));
      else if (item.type === 'contest') res.push(this.renderContest(domainId, item).catch(() => ''));
      else if (item.type === 'homework') res.push(this.renderHomework(domainId, item).catch(() => ''));
      else res.push('');
    }
    this.response.body = await Promise.all(res);
  }
}

export function apply(ctx: Context) {
  if (process.env.HYDRO_CLI) return;
  ctx.Route('wiki_help', '/wiki/help', WikiHelpHandler);
  ctx.Route('wiki_about', '/wiki/about', WikiAboutHandler);
  ctx.Route('set_theme', '/set_theme/:theme', SetThemeHandler);
  ctx.Route('set_legacy', '/legacy', LegacyModeHandler);
  ctx.Route('markdown', '/markdown', MarkdownHandler);
  ctx.Route('config_schema', '/manage/config/schema.json', SystemConfigSchemaHandler, PRIV.PRIV_EDIT_SYSTEM);
  ctx.Route('media', '/media', RichMediaHandler);
  ctx.plugin(require('./backendlib/builder'));
  ctx.on('handler/after/DiscussionRaw', async (that) => {
    if (that.args.render && that.response.type === 'text/markdown') {
      that.response.type = 'text/html';
      that.response.body = await markdown.render(that.response.body);
    }
  });
  ctx.on('handler/after', async (that) => {
    that.UiContext.SWConfig = {
      preload: SystemModel.get('ui-default.preload'),
      hosts: [
        `http://${that.request.host}`,
        `https://${that.request.host}`,
        SystemModel.get('server.url'),
        SystemModel.get('server.cdn'),
      ],
      domains: SystemModel.get('ui-default.domains') || [],
    };
  });
}
