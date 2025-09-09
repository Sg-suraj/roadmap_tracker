import logging
from flask import Blueprint, request, jsonify
from datetime import datetime
from google.cloud.firestore_v1.base_query import FieldFilter
from app import db  # This import is correct because it runs AFTER db is initialized in create_app

# RENAMED: This is now 'api' to match your __init__.py import
api = Blueprint('api', __name__) 
# Note: The url_prefix is set in __init__.py (app.register_blueprint), so we don't need it here.


# --- Helper Function for Progress ---

def calculate_progress(week_num):
    """Helper function to calculate progress stats for a given week number."""
    tasks_stream = db.collection('tasks').where(
        filter=FieldFilter('week_number', '==', int(week_num))
    ).stream()

    stats = {
        "total": 0,
        "done": 0,
        "todo": 0,
        "in_progress": 0
    }

    for task in tasks_stream:
        stats["total"] += 1
        status = task.to_dict().get('status', 'todo')
        if status == 'done':
            stats["done"] += 1
        elif status == 'in_progress':
            stats["in_progress"] += 1
        else:
            stats["todo"] += 1

    stats["percentage"] = int((stats["done"] / stats["total"]) * 100) if stats["total"] > 0 else 0
    return stats


# --- Week Routes ---
# All routes are now attached to the 'api' blueprint
@api.route('/weeks', methods=['GET'])
def get_all_weeks():
    """
    Fetches all weeks and calculates the progress for each one.
    This corresponds to your dashboard load.
    """
    try:
        weeks_ref = db.collection('weeks').order_by('week_number').stream()
        all_weeks_data = []
        
        for week_doc in weeks_ref:
            week = week_doc.to_dict()
            week['id'] = week_doc.id
            
            progress_stats = calculate_progress(week['week_number'])
            week['progress'] = progress_stats
            
            all_weeks_data.append(week)
            
        return jsonify(all_weeks_data), 200
        
    except Exception as e:
        logging.error(f"Error fetching all weeks: {e}")
        return jsonify({"error": str(e)}), 500


@api.route('/week', methods=['POST'])
def create_week():
    """Creates a new week document."""
    try:
        data = request.json
        week_num = int(data.get('week_number'))
        
        existing_week = db.collection('weeks').where(
            filter=FieldFilter('week_number', '==', week_num)
        ).limit(1).stream()

        if len(list(existing_week)) > 0:
            return jsonify({"error": f"Week {week_num} already exists"}), 409
        
        doc_ref = db.collection('weeks').document()
        doc_ref.set({
            "title": data.get('title'),
            "goal": data.get('goal'),
            "week_number": week_num
        })
        
        new_week = doc_ref.get().to_dict()
        new_week['id'] = doc_ref.id
        return jsonify(new_week), 201

    except Exception as e:
        logging.error(f"Error creating week: {e}")
        return jsonify({"error": str(e)}), 500


@api.route('/week/<int:week_number>', methods=['GET'])
def get_week_details(week_number):
    """Gets the title/goal details for a single week (for the edit modal)."""
    try:
        week_snapshot = db.collection('weeks').where(
            filter=FieldFilter('week_number', '==', week_number)
        ).limit(1).stream()
        
        week_list = list(week_snapshot)
        if not week_list:
            return jsonify({"error": "Week not found"}), 404
            
        week_doc = week_list[0]
        week_data = week_doc.to_dict()
        week_data['id'] = week_doc.id
        return jsonify(week_data), 200
        
    except Exception as e:
        logging.error(f"Error fetching week details: {e}")
        return jsonify({"error": str(e)}), 500


@api.route('/week/<int:week_number>', methods=['PUT'])
def update_week(week_number):
    """Updates a week's title or goal."""
    try:
        data = request.json
        week_snapshot = db.collection('weeks').where(
            filter=FieldFilter('week_number', '==', week_number)
        ).limit(1).stream()
        
        week_list = list(week_snapshot)
        if not week_list:
            return jsonify({"error": "Week not found"}), 404
            
        doc_id = week_list[0].id
        week_ref = db.collection('weeks').document(doc_id)
        
        update_data = {}
        if 'title' in data:
            update_data['title'] = data['title']
        if 'goal' in data:
            update_data['goal'] = data['goal']

        week_ref.update(update_data)
        
        updated_week = week_ref.get().to_dict()
        updated_week['id'] = doc_id
        return jsonify(updated_week), 200
        
    except Exception as e:
        logging.error(f"Error updating week: {e}")
        return jsonify({"error": str(e)}), 500


@api.route('/week/<int:week_number>/progress', methods=['GET'])
def get_week_progress(week_number):
    """Gets the progress for a single week."""
    try:
        progress_stats = calculate_progress(week_number)
        return jsonify(progress_stats), 200
    except Exception as e:
        logging.error(f"Error getting week progress: {e}")
        return jsonify({"error": str(e)}), 500


@api.route('/week/<int:week_number>/tasks', methods=['GET'])
def get_tasks_for_week(week_number):
    """Gets all tasks for a specific week board."""
    try:
        tasks_ref = db.collection('tasks').where(
            filter=FieldFilter('week_number', '==', week_number)
        ).order_by('order_index').stream()

        tasks = []
        for task in tasks_ref:
            task_data = task.to_dict()
            task_data['id'] = task.id
            if 'created_at' in task_data and hasattr(task_data['created_at'], 'isoformat'):
                 task_data['created_at'] = task_data['created_at'].isoformat()
            tasks.append(task_data)
        return jsonify(tasks), 200
        
    except Exception as e:
        logging.error(f"Error fetching tasks for week: {e}")
        return jsonify({"error": str(e)}), 500


# --- Task Routes ---

@api.route('/task', methods=['POST'])
def create_task():
    """Creates a new task."""
    try:
        data = request.json
        status = data.get('status', 'todo')
        week_num = int(data.get('week_number'))

        tasks_in_column_q = db.collection('tasks').where(
            filter=FieldFilter('week_number', '==', week_num)
        ).where(
            filter=FieldFilter('status', '==', status)
        )
        
        count_aggregate = tasks_in_column_q.count().get()
        order_index = count_aggregate[0][0].value

        new_task_data = {
            "title": data.get('title'),
            "description": data.get('description'),
            "priority": data.get('priority'),
            "due_date": data.get('due_date') or None,
            "status": status,
            "week_number": week_num,
            "created_at": datetime.now(),
            "order_index": order_index
        }

        doc_ref = db.collection('tasks').document()
        doc_ref.set(new_task_data)
        
        new_task = doc_ref.get().to_dict()
        new_task['id'] = doc_ref.id
        return jsonify(new_task), 201

    except Exception as e:
        logging.error(f"Error creating task: {e}")
        return jsonify({"error": str(e)}), 500


@api.route('/task/<string:task_id>', methods=['GET'])
def get_task(task_id):
    """Gets details for a single task (for the edit modal)."""
    try:
        task_doc = db.collection('tasks').document(task_id).get()
        if not task_doc.exists:
            return jsonify({"error": "Task not found"}), 404
            
        task_data = task_doc.to_dict()
        task_data['id'] = task_doc.id
        return jsonify(task_data), 200
        
    except Exception as e:
        logging.error(f"Error fetching task: {e}")
        return jsonify({"error": str(e)}), 500


@api.route('/task/<string:task_id>', methods=['PUT'])
def update_task(task_id):
    """Updates an existing task."""
    try:
        data = request.json
        task_ref = db.collection('tasks').document(task_id)
        
        if not task_ref.get().exists:
             return jsonify({"error": "Task not found"}), 404

        data.pop('id', None)
        task_ref.update(data)
        
        updated_task = task_ref.get().to_dict()
        updated_task['id'] = task_id
        return jsonify(updated_task), 200
        
    except Exception as e:
        logging.error(f"Error updating task: {e}")
        return jsonify({"error": str(e)}), 500


@api.route('/task/<string:task_id>', methods=['DELETE'])
def delete_task(task_id):
    """Deletes a task."""
    try:
        db.collection('tasks').document(task_id).delete()
        return jsonify({"status": "success", "deleted_id": task_id}), 200
    except Exception as e:
        logging.error(f"Error deleting task: {e}")
        return jsonify({"error": str(e)}), 500


@api.route('/tasks/reorder', methods=['POST'])
def reorder_tasks():
    """Handles drag-and-drop reordering using a batch write."""
    try:
        data = request.json
        tasks_to_update = data.get('tasks', [])
        
        batch = db.batch()
        for task_info in tasks_to_update:
            task_ref = db.collection('tasks').document(task_info['id'])
            batch.update(task_ref, {
                'status': task_info['status'],
                'order_index': task_info['order_index']
            })
        
        batch.commit()
        return jsonify({"status": "success", "updated_count": len(tasks_to_update)}), 200
        
    except Exception as e:
        logging.error(f"Error reordering tasks: {e}")
        return jsonify({"error": str(e)}), 500