const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const KANBOX_API_KEY = process.env.KANBOX_API_KEY || '';
const KANBOX_BASE_URL = 'https://api.kanbox.io';
const PORT = process.env.PORT || 3000;

const TOOLS = [
  { name: 'kanbox_search_members', description: 'Search Kanbox inbox, connections, or unread messages', inputSchema: { type: 'object', properties: { q: { type: 'string' }, type: { type: 'string', description: 'inbox | unread_inbox | connections' }, pipeline_name: { type: 'string' }, limit: { type: 'number' }, offset: { type: 'number' } } } },
    { name: 'kanbox_search_leads', description: 'Search scraped leads in Kanbox', inputSchema: { type: 'object', properties: { name: { type: 'string' }, q: { type: 'string' }, limit: { type: 'number' }, offset: { type: 'number' } } } },
      { name: 'kanbox_list_lists', description: 'List all Kanbox lead lists', inputSchema: { type: 'object', properties: { limit: { type: 'number' }, offset: { type: 'number' } } } },
        { name: 'kanbox_get_messages', description: 'Get conversation messages from Kanbox', inputSchema: { type: 'object', required: ['conversation_id'], properties: { conversation_id: { type: 'number' }, cursor: { type: 'string' } } } },
          { name: 'kanbox_send_message', description: 'Send a LinkedIn message via Kanbox', inputSchema: { type: 'object', required: ['recipient_linkedin_id', 'message'], properties: { recipient_linkedin_id: { type: 'string', description: 'Internal LinkedIn ID (ACoAAA...)' }, message: { type: 'string' } } } },
            { name: 'kanbox_update_member', description: 'Update a Kanbox contact - labels, pipeline, step, notes', inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'number' }, email: { type: 'string' }, phone: { type: 'string' }, labels: { type: 'array', items: { type: 'string' } }, pipeline: { type: 'string' }, step: { type: 'string' }, custom: { type: 'string' }, icebreaker: { type: 'string' } } } }
            ];

            async function callKanbox(endpoint, params, method, body) {
              params = params || {};
                method = method || 'GET';
                  const qs = method === 'GET' ? '?' + new URLSearchParams(params).toString() : '';
                    const url = KANBOX_BASE_URL + endpoint + qs;
                      const opts = { method, headers: { 'Authorization': 'Bearer ' + KANBOX_API_KEY, 'Content-Type': 'application/json' } };
                        if (body) opts.body = JSON.stringify(body);
                          const res = await fetch(url, opts);
                            const text = await res.text();
                              try { return JSON.parse(text); } catch(e) { return { raw: text, status: res.status }; }
                              }

                              async function executeTool(name, args) {
                                args = args || {};
                                  if (name === 'kanbox_search_members') {
                                      const p = {};
                                          if (args.q) p.q = args.q;
                                              if (args.type) p.type = args.type;
                                                  if (args.pipeline_name) p.pipeline_name = args.pipeline_name;
                                                      if (args.limit) p.limit = args.limit;
                                                          if (args.offset) p.offset = args.offset;
                                                              return callKanbox('/public/members', p);
                                                                }
                                                                  if (name === 'kanbox_search_leads') {
                                                                      const p = {};
                                                                          if (args.name) p.name = args.name;
                                                                              if (args.q) p.q = args.q;
                                                                                  if (args.limit) p.limit = args.limit;
                                                                                      if (args.offset) p.offset = args.offset;
                                                                                          return callKanbox('/public/leads', p);
                                                                                            }
                                                                                              if (name === 'kanbox_list_lists') {
                                                                                                  return callKanbox('/public/lists', { limit: args.limit || 50, offset: args.offset || 0 });
                                                                                                    }
                                                                                                      if (name === 'kanbox_get_messages') {
                                                                                                          const p = { conversation_id: args.conversation_id };
                                                                                                              if (args.cursor) p.cursor = args.cursor;
                                                                                                                  return callKanbox('/public/messages', p);
                                                                                                                    }
                                                                                                                      if (name === 'kanbox_send_message') {
                                                                                                                          return callKanbox('/public/messages', {}, 'POST', { recipient_linkedin_id: args.recipient_linkedin_id, message: args.message });
                                                                                                                            }
                                                                                                                              if (name === 'kanbox_update_member') {
                                                                                                                                  return callKanbox('/public/members/' + args.id, {}, 'PATCH', args);
                                                                                                                                    }
                                                                                                                                      throw new Error('Unknown tool: ' + name);
                                                                                                                                      }
                                                                                                                                      
                                                                                                                                      app.post('/mcp', async (req, res) => {
                                                                                                                                        const { id, method, params } = req.body || {};
                                                                                                                                          try {
                                                                                                                                              if (method === 'initialize') return res.json({ jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', serverInfo: { name: 'kanbox-mcp', version: '1.0.0' }, capabilities: { tools: {} } } });
                                                                                                                                                  if (method === 'notifications/initialized') return res.status(200).json({ jsonrpc: '2.0', id, result: {} });
                                                                                                                                                      if (method === 'tools/list') return res.json({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
                                                                                                                                                          if (method === 'tools/call') {
                                                                                                                                                                const result = await executeTool(params.name, params.arguments || {});
                                                                                                                                                                      return res.json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] } });
                                                                                                                                                                          }
                                                                                                                                                                              if (method === 'ping') return res.json({ jsonrpc: '2.0', id, result: {} });
                                                                                                                                                                                  return res.json({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found: ' + method } });
                                                                                                                                                                                    } catch (err) {
                                                                                                                                                                                        return res.json({ jsonrpc: '2.0', id, error: { code: -32000, message: err.message } });
                                                                                                                                                                                          }
                                                                                                                                                                                          });
                                                                                                                                                                                          
                                                                                                                                                                                          app.get('/', (req, res) => res.json({ status: 'ok', service: 'kanbox-mcp', tools: TOOLS.length }));
                                                                                                                                                                                          
                                                                                                                                                                                          app.listen(PORT, () => console.log('Kanbox MCP server on port ' + PORT));
