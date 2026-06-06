from flask import jsonify

from config import Config
from extensions import db
from models import Investor, IPO, OrganizationMember


def get_limits(plan):
    return Config.PLAN_LIMITS.get(plan or 'free', Config.PLAN_LIMITS['free'])


def usage_for_org(organization_id):
    return {
        'investors': Investor.query.filter_by(organization_id=organization_id).count(),
        'ipos': IPO.query.filter_by(organization_id=organization_id).count(),
        'members': OrganizationMember.query.filter_by(organization_id=organization_id).count(),
    }


def check_limit(organization, resource):
    """Return (ok, error_message, limits_dict)."""
    limits = get_limits(organization.plan)
    usage = usage_for_org(organization.id)
    cap_key = f'max_{resource}'
    cap = limits.get(cap_key)
    current = usage.get(resource, 0)
    if cap is not None and current >= cap:
        return False, (
            f'{resource.capitalize()} limit reached for {organization.plan} plan '
            f'({current}/{cap}). Upgrade to Pro for higher limits.'
        ), {'usage': usage, 'limits': limits}
    return True, None, {'usage': usage, 'limits': limits}


def plan_limit_response(message, usage_limits):
    return jsonify({
        'error': message,
        'upgrade_required': True,
        'usage': usage_limits.get('usage'),
        'limits': usage_limits.get('limits'),
    }), 402
