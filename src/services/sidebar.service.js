const { Project, Folder, AppFile } = require('../models');
const { NotFoundError } = require('../middleware/errorHandler');

/**
 * Entity-level constants — defines the hierarchy order.
 *
 *   Level 0 → Project  (root)
 *   Level 1 → Folder   (child of Project)
 *   Level 2 → File     (child of Folder)
 */
const LEVELS = {
    project: 0,
    folder: 1,
    file: 2,
};

/**
 * Fetch a single entity by id from MongoDB and return a breadcrumb node.
 *
 * @param {'project'|'folder'|'file'} type
 * @param {string} id  - MongoDB ObjectId string
 * @returns {{ id, name, type, level, parentId: string|null }}
 */
async function fetchNode(type, id) {
    switch (type) {
        case 'project': {
            const doc = await Project.findById(id).lean();
            if (!doc) throw new NotFoundError(`Project ${id} not found`);
            return {
                id: doc._id.toString(),
                name: doc.name,
                type: 'project',
                level: LEVELS.project,
                parentId: null,
            };
        }

        case 'folder': {
            const doc = await Folder.findById(id).lean();
            if (!doc) throw new NotFoundError(`Folder ${id} not found`);
            return {
                id: doc._id.toString(),
                name: doc.name,
                type: 'folder',
                level: LEVELS.folder,
                parentId: doc.projectId.toString(),
            };
        }

        case 'file': {
            const doc = await AppFile.findById(id).lean();
            if (!doc) throw new NotFoundError(`File ${id} not found`);
            return {
                id: doc._id.toString(),
                name: doc.name,
                type: 'file',
                level: LEVELS.file,
                parentId: doc.folderId.toString(),
            };
        }

        default:
            throw new Error(`Unknown entity type: ${type}`);
    }
}

/**
 * Determine the parent entity type one level up in the hierarchy.
 *
 * file   → folder
 * folder → project
 * project → null  (already at root)
 */
function parentType(type) {
    if (type === 'file') return 'folder';
    if (type === 'folder') return 'project';
    return null;
}

/**
 * Recursively builds a breadcrumb trail from any entity back to the root.
 *
 * Strategy:
 *   1. Fetch the current node.
 *   2. If it has a parent, recurse upward with the parent's type + id.
 *   3. Concatenate: ancestor crumbs come first, current node appended last.
 *      Result is always ordered root → … → current  (left = root, right = leaf).
 *
 * @param {'project'|'folder'|'file'} type   - entity type of the starting node
 * @param {string}                    id     - MongoDB ObjectId string
 * @returns {Promise<Array<{ id, name, type, level, parentId }>>}
 *
 * @example
 *   // Starting from a file
 *   await getBreadcrumb('file', fileId)
 *   // → [
 *   //     { id: '...', name: 'My Project', type: 'project', level: 0, parentId: null },
 *   //     { id: '...', name: 'Weekly Reports', type: 'folder',  level: 1, parentId: '...' },
 *   //     { id: '...', name: 'Report Jan',     type: 'file',    level: 2, parentId: '...' },
 *   //   ]
 *
 *   // Starting from a folder (only returns project + folder)
 *   await getBreadcrumb('folder', folderId)
 *   // → [
 *   //     { id: '...', name: 'My Project',     type: 'project', level: 0, parentId: null },
 *   //     { id: '...', name: 'Weekly Reports', type: 'folder',  level: 1, parentId: '...' },
 *   //   ]
 */
async function getBreadcrumb(type, id) {
    // 1. Fetch current node
    const node = await fetchNode(type, id);

    // 2. Base case — we're at the root (project), nothing above us
    const parent = parentType(type);
    if (!parent) {
        return [node];
    }

    // 3. Recursive case — climb one level up using the parentId stored on the node
    const ancestors = await getBreadcrumb(parent, node.parentId);

    // 4. Append current node at the end → trail is root-first
    return [...ancestors, node];
}

module.exports = { getBreadcrumb, LEVELS };